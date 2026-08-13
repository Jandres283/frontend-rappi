import { useEffect, useState } from "react";
import { 
  FiX, 
  FiPackage, 
  FiClock, 
  FiCheckCircle, 
  FiTruck, 
  FiRefreshCw, 
  FiXCircle 
} from "react-icons/fi";
import "./OrderHistoryModal.scss";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

const getStatusConfig = (rawStatus) => {
  const status = (rawStatus || "").toLowerCase();

  if (status.includes("pendient") || status.includes("pending")) {
    return { label: "Pendiente", className: "pending", icon: <FiClock /> };
  }
  if (status.includes("prepar") || status.includes("preparing") || status.includes("cocina")) {
    return { label: "En Preparación", className: "preparing", icon: <FiRefreshCw className="spin" /> };
  }
  if (status.includes("camino") || status.includes("delivery") || status.includes("dispatch")) {
    return { label: "En Camino", className: "in-delivery", icon: <FiTruck /> };
  }
  if (status.includes("cancel")) {
    return { label: "Cancelado", className: "cancelled", icon: <FiXCircle /> };
  }
  
  return { label: rawStatus || "Entregado", className: "delivered", icon: <FiCheckCircle /> };
};

export const OrderHistoryModal = ({ isOpen, onClose, user: propUser }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchOrders = async () => {
      setLoading(true);
      const token = localStorage.getItem("token") || localStorage.getItem("auth_token_jwt");

      // 1. Obtener usuario de props o localStorage
      let rawUser = propUser;
      if (!rawUser) {
        try {
          const stored = localStorage.getItem("user");
          if (stored) rawUser = JSON.parse(stored);
        } catch {
          // Ignorar error de parseo
        }
      }

      // 2. Extraer identificadores del usuario activo
      const userId = rawUser?._id || rawUser?.id || rawUser?.uid || rawUser?.user?._id || rawUser?.user?.id;
      const userName = (rawUser?.firstName || rawUser?.firstname || rawUser?.nombre || rawUser?.name || "").toLowerCase().trim();
      const userPhone = (rawUser?.phone || rawUser?.telefono || "").trim();

      if (!token) {
        if (isMounted) {
          setOrders([]);
          setLoading(false);
        }
        return;
      }

      // Rutas candidatas del backend
      const candidateUrls = [
        `${API_URL}/orders`,
        userId ? `${API_URL}/orders/user/${userId}` : null,
        userId ? `${API_URL}/orders?user=${userId}` : null,
        `${API_URL}/order`,
      ].filter(Boolean);

      let fetchedOrders = null;

      for (const url of candidateUrls) {
        try {
          const response = await fetch(url, {
            headers: { 
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            }
          });

          if (response.ok) {
            const data = await response.json();
            const rawList = Array.isArray(data) ? data : data.orders || data.data || [];
            
            // FILTRADO FLEXIBLE: Compara por ID, Nombre (ej: Ale Mendoza) o Teléfono
            if (rawList.length > 0) {
              fetchedOrders = rawList.filter(o => {
                const oUser = o.user?._id || o.user?.id || o.user || o.userId || o.client?._id || o.client?.id;
                const oClientName = (o.clientName || o.customerName || o.client?.name || o.client || o.nombreCliente || o.nombre || "").toLowerCase().trim();
                const oPhone = (o.phone || o.telefono || o.clientPhone || "").trim();

                // 1. Coincide ID
                if (userId && oUser && String(oUser) === String(userId)) return true;
                // 2. Coincide Nombre de cliente
                if (userName && oClientName && (oClientName.includes(userName) || userName.includes(oClientName))) return true;
                // 3. Coincide Teléfono
                if (userPhone && oPhone && oPhone.includes(userPhone)) return true;

                // Si la URL llamada ya era específica de ese usuario (/orders/user/ID), la aceptamos
                if (url.includes('/user/')) return true;

                return false;
              });

              // Si la búsqueda por filtro estricto dio 0 pero el endpoint era directo, devolvemos todo lo del endpoint
              if (fetchedOrders.length === 0 && url.includes('/user/')) {
                fetchedOrders = rawList;
              }
            } else {
              fetchedOrders = [];
            }

            break; // Detener bucle si la llamada fue exitosa
          }
        } catch {
          // Continuar con la siguiente ruta candidata
        }
      }

      if (isMounted) {
        if (fetchedOrders) {
          const sorted = fetchedOrders.sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
          setOrders(sorted);
        } else {
          setOrders([]);
        }
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchOrders();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, propUser]);

  if (!isOpen) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="ordersCard" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="btnClose" onClick={onClose}>
          <FiX />
        </button>

        <div className="ordersHeader">
          <FiPackage className="headerIcon" />
          <h3>Mis Pedidos</h3>
        </div>

        {loading ? (
          <p className="loadingText">Cargando tus pedidos...</p>
        ) : orders.length === 0 ? (
          <div className="emptyOrders">
            <FiClock className="emptyIcon" />
            <p>Aún no has realizado ningún pedido.</p>
          </div>
        ) : (
          <div className="ordersList">
            {orders.map((order, idx) => {
              const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
              const orderId = order._id ? order._id.slice(-6).toUpperCase() : order.id || idx + 1;
              const totalAmount = Number(order.total || order.amount || 0);
              const statusConfig = getStatusConfig(order.status);
              const itemsList = order.items || order.products || [];

              return (
                <div key={order._id || order.id || idx} className="orderItem">
                  <div className="orderTop">
                    <span className="orderId">Pedido #{orderId}</span>
                    <span className={`orderStatus ${statusConfig.className}`}>
                      {statusConfig.icon} {statusConfig.label}
                    </span>
                  </div>

                  {itemsList.length > 0 && (
                    <ul className="orderProductsSummary">
                      {itemsList.map((item, i) => (
                        <li key={i}>
                          {item.quantity || item.cant || 1}x {item.name || item.title || item.product?.name || "Producto"}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="orderDetails">
                    <p className="orderDate">
                      {orderDate.toLocaleDateString()} - {orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="orderTotal">
                      Total: S/ {totalAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistoryModal;