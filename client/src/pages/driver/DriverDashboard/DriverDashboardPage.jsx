import { useState, useEffect, useCallback, useRef } from "react";
import io from "socket.io-client";

// ✅ Importaciones de componentes del Repartidor
import {
  AvailableOrdersList,
  ActiveOrderCard,
  DeliveryMap,
  LocationUpdater,
} from "../../../components/Driver";

import { useAuth } from "../../../hooks";
import api from "@/api/axios";
import { ENV } from "@/utils/constants";
import "./DriverDashboardPage.scss";

const parseOrdersList = (resData) => {
  if (!resData) return [];
  if (Array.isArray(resData)) return resData;
  if (Array.isArray(resData.orders)) return resData.orders;
  if (Array.isArray(resData.data)) return resData.data;
  if (Array.isArray(resData.docs)) return resData.docs;
  return [];
};

const parseActiveOrder = (resData) => {
  if (!resData) return null;
  if (resData.activeOrder) return resData.activeOrder;
  if (resData.order) return resData.order;
  if (resData.data && typeof resData.data === "object" && !Array.isArray(resData.data)) {
    return resData.data;
  }
  if (typeof resData === "object" && !Array.isArray(resData) && resData._id) {
    return resData;
  }
  return null;
};

export const DriverDashboardPage = () => {
  const { user, logout } = useAuth();

  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);

  // 📜 Carga inicial del historial desde localStorage
  const [completedOrders, setCompletedOrders] = useState(() => {
    try {
      const saved = localStorage.getItem("driver_completed_orders");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [vehicleType, setVehicleType] = useState("Motocicleta");
  const [vehiclePlate, setVehiclePlate] = useState("ABC-123");
  const [vehicleModel, setVehicleModel] = useState("Honda Wave 110");
  const [isUpdatingVehicle, setIsUpdatingVehicle] = useState(false);

  const [driverProfile, setDriverProfile] = useState({
    rating: 5.0,
    dailyGoal: 10,
  });

  const [currentLocation, setCurrentLocation] = useState({
    lat: -12.0528,
    lng: -77.1329,
  });

  const [isAvailable, setIsAvailable] = useState(true);
  const [activeTab, setActiveTab] = useState("available");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [reload, setReload] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasPermissionError, setHasPermissionError] = useState(false);

  const isForbiddenRef = useRef(false);
  const socketRef = useRef(null);

  // 🚪 LOGOUT SEGURO
  const handleLogout = () => {
    try {
      if (typeof logout === "function") {
        logout("driver");
      }
    } catch (e) {
      console.error("Error al salir:", e);
    } finally {
      localStorage.removeItem("driver_user_data");
      localStorage.removeItem("driver_token_jwt");
      localStorage.removeItem("driver_completed_orders");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.clear();

      window.location.href = "/driver/login";
    }
  };

  // 💾 Persistencia local de pedidos completados
  useEffect(() => {
    try {
      localStorage.setItem("driver_completed_orders", JSON.stringify(completedOrders));
    } catch (e) {
      console.error("Error guardando historial local:", e);
    }
  }, [completedOrders]);

  // 📡 RASTREO GPS EN TIEMPO REAL
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = Number(position.coords.latitude);
          const lng = Number(position.coords.longitude);

          if (!isNaN(lat) && !isNaN(lng)) {
            setCurrentLocation({ lat, lng });

            if (isAvailable && !isForbiddenRef.current) {
              api
                .patch("/driver/location", { lat, lng, latitude: lat, longitude: lng })
                .catch((err) => console.warn("⚠️ GPS Error:", err.response?.data));

              if (socketRef.current) {
                socketRef.current.emit("driver_location_update", {
                  driverId: user?._id || user?.id,
                  lat,
                  lng,
                  activeOrderId: activeOrder?._id || activeOrder?.id,
                });
              }
            }
          }
        },
        null,
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isAvailable, activeOrder, user]);

  // 📦 OBTENER ÓRDENES SOLO CUANDO EL RESTAURANTE LAS SUBA O MARQUE COMO LISTAS
  const fetchOrdersData = useCallback(async () => {
    if (isForbiddenRef.current) return;

    try {
      const [availRes, activeRes, generalRes, deliveredRes] = await Promise.all([
        api.get("/driver/orders/available").catch((err) => err.response),
        api.get("/driver/orders/active").catch((err) => err.response),
        api.get("/orders?page=1&limit=100").catch((err) => err.response),
        api.get("/orders?status=DELIVERED&limit=100").catch((err) => err.response),
      ]);

      if (
        availRes?.status === 403 ||
        activeRes?.status === 403 ||
        generalRes?.status === 403
      ) {
        isForbiddenRef.current = true;
        setHasPermissionError(true);
        return;
      }

      let parsedAvail = availRes?.status === 200 && availRes?.data ? parseOrdersList(availRes.data) : [];
      let parsedActive = activeRes?.status === 200 && activeRes?.data ? parseActiveOrder(activeRes.data) : null;
      let parsedHistory = [];

      const possibleUserIds = [
        user?._id,
        user?.id,
        user?.user_id,
        user?.driverId,
        user?.driver?._id,
      ].filter(Boolean).map((id) => String(id));

      if (generalRes?.status === 200 && generalRes?.data) {
        const allOrders = parseOrdersList(generalRes.data);

        // 🎯 LÓGICA CLAVE: Solo mostrar a los conductores si el restaurante la subió/listó
        // (Excluimos estados iniciales como PENDING o CREATED creados solo por el cliente)
        if (parsedAvail.length === 0) {
          parsedAvail = allOrders.filter((o) => {
            const st = String(o.status || "").toUpperCase();
            const driver = o.deliveryDriver || o.driver;
            const driverId = String(driver?._id || driver?.id || driver || "");
            const hasNoDriver = !driver || driverId === "" || driverId === "null" || driverId === "undefined";

            // 🛑 Solo disponible si el restaurante la subió/confirmó para entrega (Ej: READY / LISTO / PUBLISHED)
            const isRestaurantApproved = ["READY", "LISTO", "READY_FOR_PICKUP", "PREPARING_DISPATCH", "PREPARADO"].includes(st);

            return isRestaurantApproved && hasNoDriver;
          });
        }

        if (!parsedActive) {
          parsedActive =
            allOrders.find((o) => {
              const driver = o.deliveryDriver || o.driver;
              const driverId = String(driver?._id || driver?.id || driver || "");
              const st = String(o.status || "").toUpperCase();
              const isInProgress = ["IN_DELIVERY", "IN_TRANSIT", "EN_CAMINO", "ACCEPTED", "ON_THE_WAY"].includes(st);
              return possibleUserIds.includes(driverId) && isInProgress;
            }) || null;
        }
      }

      if (deliveredRes?.status === 200 && deliveredRes?.data) {
        parsedHistory = parseOrdersList(deliveredRes.data);
      }

      setAvailableOrders(parsedAvail);
      setActiveOrder(parsedActive);

      if (parsedActive && socketRef.current) {
        const orderRoomId = parsedActive._id || parsedActive.id;
        socketRef.current.emit("join_room", orderRoomId);
      }

      let localSaved = [];
      try {
        const rawLocal = localStorage.getItem("driver_completed_orders");
        if (rawLocal) localSaved = JSON.parse(rawLocal);
      } catch (e) {
        console.error("Error leyendo historial local:", e);
      }

      setCompletedOrders(() => {
        const combined = [...localSaved, ...parsedHistory];
        const uniqueMap = new Map();
        combined.forEach((item) => {
          const id = item._id || item.id || item.code;
          if (id && !uniqueMap.has(id)) {
            uniqueMap.set(id, item);
          }
        });
        return Array.from(uniqueMap.values());
      });
    } catch (e) {
      console.error("Error obteniendo pedidos:", e);
    }
  }, [user]);

  // ⚡ CONEXIÓN A SOCKET.IO
  useEffect(() => {
    const socketHost = ENV?.SERVER_HOST || "http://localhost:3977";
    const socket = io(socketHost, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("⚡ Repartidor conectado vía Sockets:", socket.id);
    });

    // Eventos emitidos cuando un restaurante publica o actualiza el pedido
    socket.on("order_updated", () => fetchOrdersData());
    socket.on("new_order", () => fetchOrdersData());
    socket.on("restaurant_order_ready", () => fetchOrdersData());

    return () => {
      if (socket) {
        socket.off();
        socket.disconnect();
      }
    };
  }, [fetchOrdersData]);

  // 👤 CARGAR PERFIL
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const profileRes = await api.post("/driver/profile", {}).catch((err) => err.response);

        if (profileRes?.status === 403) {
          isForbiddenRef.current = true;
          setHasPermissionError(true);
          return;
        }

        if (profileRes?.status === 200 && profileRes?.data && isMounted) {
          const p = profileRes.data;
          setVehicleType(p.vehicleType || p.type || "Motocicleta");
          setVehiclePlate(p.vehiclePlate || p.licensePlate || "ABC-123");
          setVehicleModel(p.vehicleModel || "Honda Wave 110");
          setDriverProfile((prev) => ({
            ...prev,
            rating: p.rating ?? prev.rating,
          }));
          if (p.isAvailable !== undefined) {
            setIsAvailable(p.isAvailable);
          }
        }

        if (isMounted) {
          await fetchOrdersData();
        }
      } catch (err) {
        console.error("Error cargando panel:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [reload, fetchOrdersData]);

  const handleToggleAvailability = async () => {
    const nextState = !isAvailable;
    setIsUpdatingStatus(true);
    try {
      const { data } = await api.patch("/driver/availability", { isAvailable: nextState });
      setIsAvailable(data.isAvailable ?? nextState);
    } catch (err) {
      alert(`⚠️ Error: ${err.response?.data?.msg || "No se pudo cambiar el estado del servicio."}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleUpdateVehicleSubmit = async (e) => {
    e.preventDefault();
    setIsUpdatingVehicle(true);
    try {
      await api.post("/driver/profile", {
        vehicleType,
        vehiclePlate,
        vehicleModel,
      });
      alert("✅ ¡Datos del vehículo actualizados!");
    } catch (err) {
      alert(`⚠️ ${err.response?.data?.msg || "Error al actualizar información del vehículo"}`);
    } finally {
      setIsUpdatingVehicle(false);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      await api.patch(`/driver/orders/${orderId}/accept`).catch(() =>
        api.patch(`/orders/${orderId}`, {
          deliveryDriver: user?._id || user?.id,
          status: "IN_DELIVERY",
        })
      );

      if (socketRef.current) {
        socketRef.current.emit("join_room", orderId);
        socketRef.current.emit("update_status", { orderId, status: "IN_DELIVERY" });
      }

      alert("🎉 ¡Pedido aceptado!");
      setActiveTab("active");
      fetchOrdersData();
    } catch (err) {
      alert(`⚠️ ${err.response?.data?.msg || "No se pudo tomar la orden."}`);
    }
  };

  const handleCompleteOrder = async (orderId) => {
    try {
      setIsLoading(true);

      const res = await api.patch(`/driver/orders/${orderId}/complete`).catch(() =>
        api.patch(`/orders/${orderId}`, { status: "DELIVERED" })
      );

      const serverOrder = res?.data?.order || res?.data;

      let newCompletedItem = null;
      if (serverOrder && serverOrder._id) {
        newCompletedItem = serverOrder;
      } else if (activeOrder) {
        newCompletedItem = {
          ...activeOrder,
          _id: activeOrder._id || activeOrder.id || orderId,
          code: activeOrder.code || (activeOrder._id ? String(activeOrder._id).slice(-6).toUpperCase() : "ENTREGA"),
          status: "DELIVERED",
          restaurant: activeOrder.restaurant || { name: activeOrder.restaurantName || "Restaurante" },
          deliveryAddress: activeOrder.deliveryAddress || activeOrder.address || "Dirección de entrega",
          total: activeOrder.total || activeOrder.totalAmount || activeOrder.price || 45.00,
        };
      }

      if (socketRef.current) {
        socketRef.current.emit("update_status", { orderId, status: "DELIVERED" });
        socketRef.current.emit("leave_room", orderId);
      }

      setCompletedOrders((prevHistory) => [newCompletedItem, ...prevHistory]);
      setActiveOrder(null);
      setActiveTab("history");

      alert("🎉 ¡Entrega finalizada!");
      fetchOrdersData();
    } catch (err) {
      console.error("Error completando orden:", err);
      alert(`⚠️ ${err.response?.data?.msg || "Error al completar la entrega."}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("¿Seguro que deseas limpiar el historial local?")) {
      localStorage.removeItem("driver_completed_orders");
      setCompletedOrders([]);
    }
  };

  const filteredOrders = availableOrders.filter((order) => {
    const search = searchTerm.toLowerCase();
    const idMatches = order._id?.toLowerCase().includes(search) || order.code?.toLowerCase().includes(search);
    const restMatches = order.restaurant?.name?.toLowerCase().includes(search);
    const addressMatches =
      order.deliveryAddress?.toLowerCase().includes(search) || order.address?.toLowerCase().includes(search);
    return idMatches || restMatches || addressMatches;
  });

  const completedTodayCount = completedOrders.length;
  const totalEarningsToday = completedOrders.reduce((sum, order) => {
    const amount = Number(order.total || order.deliveryFee || order.price || order.totalAmount || 0);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const goalPercentage = Math.min(
    100,
    Math.round((completedTodayCount / (driverProfile.dailyGoal || 10)) * 100)
  );

  return (
    <div className="driver-dashboard-pro">
      {/* HEADER */}
      <header className="dash-header">
        <div className="brand-user">
          <div className="avatar-box">🛵</div>
          <div className="user-info">
            <h2>Panel de Repartidor</h2>
            <p>
              Sesión activa: <strong>{user?.email || "carlos.driver@test.com"}</strong>
            </p>
          </div>
        </div>

        <div className="header-controls">
          <button className="btn-icon" onClick={() => setReload((prev) => !prev)} title="Refrescar datos">
            🔄 Actualizar
          </button>
          <button className="btn-logout-danger" onClick={handleLogout}>
            🚪 Cerrar Sesión
          </button>
        </div>
      </header>

      {hasPermissionError && (
        <div
          className="permission-error-banner"
          style={{
            backgroundColor: "#ffebee",
            color: "#c62828",
            padding: "12px 20px",
            borderRadius: "8px",
            margin: "15px 0",
            border: "1px solid #ef9a9a",
            fontWeight: "bold",
          }}
        >
          ⚠️ No tienes permisos suficientes o tu sesión expiró.
        </div>
      )}

      {/* MÉTRICAS */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span>Ganancias de Hoy</span>
            <span className={`chip ${isAvailable ? "chip-success" : "chip-danger"}`}>
              {isAvailable ? "Conectado" : "Desconectado"}
            </span>
          </div>
          <div className="stat-body">
            <h3>S/ {totalEarningsToday.toFixed(2)}</h3>
            <span className="subtext">{completedTodayCount} entregados</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Meta Diaria</span>
            <span className="chip chip-info">
              {completedTodayCount}/{driverProfile.dailyGoal} Pedidos
            </span>
          </div>
          <div className="stat-body">
            <h3>{goalPercentage}%</h3>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${goalPercentage}%` }}></div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>Calificación</span>
            <span className="star-rating">★ 5</span>
          </div>
          <div className="stat-body">
            <h3>
              {driverProfile.rating} <small>/ 5.0</small>
            </h3>
            <span className="subtext">48 valoraciones</span>
          </div>
        </div>

        <div className={`stat-card status-banner ${isAvailable ? "is-online" : "is-offline"}`}>
          <div className="stat-header">
            <span>Estado del Servicio</span>
          </div>
          <div className="stat-body">
            <p style={{ margin: "5px 0", fontWeight: "600" }}>
              Estado: <strong>{isAvailable ? "Conectado" : "Inactivo"}</strong>
            </p>
            <button
              onClick={handleToggleAvailability}
              disabled={isUpdatingStatus}
              style={{
                backgroundColor: isAvailable ? "#d32f2f" : "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: "20px",
                padding: "8px 16px",
                cursor: "pointer",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "6px",
              }}
            >
              <span
                style={{
                  height: "10px",
                  width: "10px",
                  backgroundColor: "#fff",
                  borderRadius: "50%",
                  display: "inline-block",
                }}
              ></span>
              {isUpdatingStatus ? "Cargando..." : isAvailable ? "Pasar a Inactivo" : "Pasar a Activo"}
            </button>
          </div>
        </div>
      </section>

      {/* DASHBOARD PRINCIPAL */}
      <div className="dashboard-grid">
        <aside className="dash-sidebar">
          <div className="sidebar-box telemetry-box">
            <h4 style={{ marginBottom: "8px" }}>Rastreo GPS en Tiempo Real</h4>
            <p style={{ color: "#666", fontSize: "14px" }}>
              Lat: {currentLocation.lat.toFixed(4)}, Lng: {currentLocation.lng.toFixed(4)}
            </p>
            <LocationUpdater currentLocation={currentLocation} isTracking={isAvailable} />
          </div>

          <div
            className="sidebar-box"
            style={{
              background: "#fff",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid #eee",
            }}
          >
            <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#333" }}>
              Datos del Vehículo
            </h3>
            <form onSubmit={handleUpdateVehicleSubmit}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                  Tipo de Vehículo
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                >
                  <option value="Motocicleta">Motocicleta</option>
                  <option value="Bicicleta">Bicicleta</option>
                  <option value="Auto">Auto</option>
                </select>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                  Placa / Matrícula
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                  placeholder="ABC-123"
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                  Modelo / Marca
                </label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                  placeholder="Ej: Honda Wave 110"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdatingVehicle}
                style={{
                  width: "100%",
                  padding: "10px",
                  backgroundColor: "#e0e0e0",
                  color: "#333",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                {isUpdatingVehicle ? "Guardando..." : "Actualizar Vehículo"}
              </button>
            </form>
          </div>
        </aside>

        <main className="dash-main">
          <div className="tabs-bar">
            <button
              className={`tab-item ${activeTab === "available" ? "active" : ""}`}
              onClick={() => setActiveTab("available")}
            >
              📦 Disponibles <span className="badge-count">{availableOrders.length}</span>
            </button>

            <button
              className={`tab-item ${activeTab === "active" ? "active" : ""}`}
              onClick={() => setActiveTab("active")}
            >
              🚀 En Curso {activeOrder && <span className="active-dot"></span>}
            </button>

            <button
              className={`tab-item ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              📜 Historial <span className="badge-count">{completedOrders.length}</span>
            </button>
          </div>

          <div className="tab-content-area">
            {activeTab === "available" && (
              <div className="tab-pane">
                <div className="pane-top-bar">
                  <h3>Órdenes Listas para Entrega</h3>
                  <div className="search-box">
                    <input
                      type="text"
                      placeholder="🔍 Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <AvailableOrdersList
                  orders={filteredOrders}
                  onAccept={handleAcceptOrder}
                  isLoading={isLoading}
                />
              </div>
            )}

            {activeTab === "active" && (
              <div className="tab-pane">
                <h3>Pedido en Curso</h3>
                {activeOrder ? (
                  <div className="active-order-container">
                    <ActiveOrderCard
                      activeOrder={activeOrder}
                      onCompleteOrder={handleCompleteOrder}
                      isLoading={isLoading}
                    />
                    <DeliveryMap
                      coordinates={{ lat: currentLocation.lat, lng: currentLocation.lng }}
                      address={activeOrder?.deliveryAddress || "Dirección de entrega"}
                    />
                  </div>
                ) : (
                  <div className="empty-panel">
                    <div className="empty-icon">📦</div>
                    <h4>Sin entregas activas</h4>
                    <p>Acepta un pedido disponible para comenzar a rastrearlo.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="tab-pane">
                <div
                  style={{
                    display: "flex",
                    justify: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <h3 style={{ margin: 0 }}>Historial de Hoy</h3>
                  {completedOrders.length > 0 && (
                    <button
                      onClick={handleClearHistory}
                      style={{
                        fontSize: "12px",
                        color: "#888",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      🗑️ Limpiar Historial Local
                    </button>
                  )}
                </div>

                {completedOrders.length > 0 ? (
                  <div className="history-orders-list">
                    <div className="table-responsive" style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid #eee" }}>
                            <th style={{ padding: "12px" }}>Pedido #</th>
                            <th style={{ padding: "12px" }}>Restaurante</th>
                            <th style={{ padding: "12px" }}>Dirección</th>
                            <th style={{ padding: "12px" }}>Total Ganado</th>
                            <th style={{ padding: "12px" }}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {completedOrders.map((ord, idx) => {
                            const orderId = ord._id || ord.id || ord.code || idx;
                            const displayCode =
                              ord.code ||
                              (ord._id ? `#${String(ord._id).slice(-6).toUpperCase()}` : `#ORD-${idx + 1}`);
                            const restName = ord.restaurant?.name || ord.restaurantName || "Restaurante";
                            const addr = ord.deliveryAddress || ord.address || "Dirección registrada";
                            const totalVal = Number(
                              ord.total || ord.deliveryFee || ord.price || ord.totalAmount || 0
                            );

                            return (
                              <tr key={orderId} style={{ borderBottom: "1px solid #f2f2f2" }}>
                                <td style={{ padding: "12px", fontWeight: "bold" }}>{displayCode}</td>
                                <td style={{ padding: "12px" }}>{restName}</td>
                                <td style={{ padding: "12px", fontSize: "13px", color: "#555" }}>{addr}</td>
                                <td style={{ padding: "12px", color: "#2e7d32", fontWeight: "bold" }}>
                                  S/ {totalVal.toFixed(2)}
                                </td>
                                <td style={{ padding: "12px" }}>
                                  <span
                                    style={{
                                      backgroundColor: "#e8f5e9",
                                      color: "#2e7d32",
                                      padding: "4px 8px",
                                      borderRadius: "4px",
                                      fontSize: "12px",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    ✓ Entregado
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="empty-panel">
                    <div className="empty-icon">📊</div>
                    <h4>No has completado entregas hoy</h4>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DriverDashboardPage;