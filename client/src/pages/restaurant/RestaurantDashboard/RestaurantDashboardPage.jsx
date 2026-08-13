import { useState, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import io from "socket.io-client";
import useAuth from "@/hooks/useAuth";
import { authFetch } from "@/utils/authFetch";
import { ENV } from "@/utils/constants";
import "./RestaurantDashboardPage.scss";

// 🛠️ FUNCIÓN PARA FORMATEAR RUTA DE IMÁGENES
const getImageUrl = (source) => {
  const DEFAULT_IMAGE =
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";

  if (!source) return DEFAULT_IMAGE;

  let imagePath = source;

  if (typeof source === "object") {
    imagePath =
      source.miniature ||
      source.image ||
      source.imagen ||
      source.logo ||
      source.avatar ||
      source.photo ||
      source.cover ||
      source.picture ||
      source.user?.avatar ||
      source.user?.image;
  }

  if (!imagePath || typeof imagePath !== "string") return DEFAULT_IMAGE;

  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://") ||
    imagePath.startsWith("data:") ||
    imagePath.startsWith("blob:")
  ) {
    return imagePath;
  }

  const cleanPath = imagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const host = (ENV?.SERVER_HOST || "http://localhost:3977").replace(/\/$/, "");

  if (cleanPath.startsWith("uploads/")) {
    return `${host}/${cleanPath}`;
  }

  return `${host}/uploads/${cleanPath}`;
};

// ICONOS SVG NATIVOS
const Utensils = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2v6a6 6 0 0 1-6 6v8"/>
    <path d="M6 2v20"/>
    <path d="M10 2v6a2 2 0 0 1-2 2H6"/>
  </svg>
);

const ShoppingBag = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const Plus = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/>
    <path d="M12 5v14"/>
  </svg>
);

const Trash2 = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    <line x1="10" x2="10" y1="11" y2="17"/>
    <line x1="14" x2="14" y1="11" y2="17"/>
  </svg>
);

const Search = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
);

const Power = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v10"/>
    <path d="M18.4 6.6a9 9 0 1 1-12.77 0"/>
  </svg>
);

const CloseIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </svg>
);

export function RestaurantDashboardPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("menu");
  const [isOpen, setIsOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [restaurantData, setRestaurantData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    imageFile: null
  });

  const userId = user?._id || user?.id || user?.user_id;

  // 1. CARGA INICIAL DE DATOS
  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      if (isMounted) setLoading(true);
      let activeRestaurant = null;

      try {
        const resMe = await authFetch.get("/restaurant/me");
        if (resMe?.data) activeRestaurant = resMe.data;
      } catch {
        if (userId) {
          try {
            const resQuery = await authFetch.get(`/restaurants?user=${userId}`);
            const dataQuery = resQuery?.data;
            const list = Array.isArray(dataQuery)
              ? dataQuery
              : dataQuery?.docs || dataQuery?.data || [];
            if (list.length > 0) activeRestaurant = list[0];
          } catch (errQuery) {
            console.error("Error obteniendo restaurante:", errQuery);
          }
        }
      }

      if (isMounted && activeRestaurant) {
        setRestaurantData(activeRestaurant);
      }

      const restId = activeRestaurant?._id || activeRestaurant?.id || user?.restaurant || user?.restaurantId;

      try {
        const endpoint = restId ? `/products?restaurant=${restId}` : `/products?user=${userId}`;
        const resAll = await authFetch.get(endpoint);
        const dataAll = resAll?.data;
        const fetchedProducts = Array.isArray(dataAll) ? dataAll : dataAll?.products || dataAll?.docs || dataAll?.data || [];

        if (isMounted) {
          if (restId) {
            const filteredByRest = fetchedProducts.filter((p) => {
              const pRest = p?.restaurant?._id || p?.restaurant || p?.restaurantId;
              const pUser = p?.user?._id || p?.user;
              return String(pRest) === String(restId) || String(pUser) === String(userId);
            });
            setProducts(filteredByRest);
          } else {
            setProducts(fetchedProducts);
          }
        }
      } catch (err) {
        console.error("Error al cargar productos:", err);
        if (isMounted) setProducts([]);
      }

      if (restId) {
        try {
          const response = await authFetch.get(`/orders?restaurant=${restId}`);
          const data = response?.data;
          const list = Array.isArray(data) ? data : data?.orders || data?.docs || data?.data || [];
          if (isMounted) setOrders(list);
        } catch (err) {
          console.error("Error al cargar pedidos:", err);
          if (isMounted) setOrders([]);
        }
      }

      if (isMounted) setLoading(false);
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, [user, userId]);

  // 2. WEBSOCKETS EN TIEMPO REAL
  const myRestId = restaurantData?._id || restaurantData?.id || user?.restaurant;

  useEffect(() => {
    const socketHost = ENV?.SERVER_HOST || "http://localhost:3977";

    const socket = io(socketHost, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("new_order", (newOrder) => {
      const orderRestId = newOrder.restaurant?._id || newOrder.restaurant;

      if (!myRestId || String(orderRestId) === String(myRestId)) {
        setOrders((prev) => [newOrder, ...prev]);
        toast.info(`🔔 ¡Nuevo Pedido #${newOrder.code || newOrder._id?.slice(-5)} recibido!`, {
          autoClose: 6000
        });
      }
    });

    socket.on("order_updated", (updatedOrder) => {
      setOrders((prev) =>
        prev.map((ord) => ((ord._id || ord.id) === (updatedOrder._id || updatedOrder.id) ? updatedOrder : ord))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [myRestId]);

  const finalImageUrl = getImageUrl(restaurantData || user);
  const restaurantName = restaurantData?.name || user?.name || user?.firstName || "Mi Restaurante";

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await authFetch.put(`/orders/${orderId}`, { status: newStatus });
      const updated = response?.data;

      setOrders((prev) =>
        prev.map((ord) => ((ord._id || ord.id) === orderId ? updated || { ...ord, status: newStatus } : ord))
      );

      if (newStatus === "READY" || newStatus === "LISTO") {
        toast.success("🚀 Pedido marcado como LISTO.");
      } else {
        toast.success(`Pedido actualizado a: ${newStatus}`);
      }
    } catch (err) {
      console.error("Error cambiando estado:", err);
      toast.error("No se pudo actualizar el pedido.");
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();

    if (!newProduct.name || !newProduct.price || !newProduct.category) {
      toast.error("Por favor completa los campos obligatorios (*)");
      return;
    }

    try {
      const targetRestId = restaurantData?._id || restaurantData?.id || user?.restaurant || userId;

      const formData = new FormData();
      formData.append("name", newProduct.name);
      formData.append("description", newProduct.description);
      formData.append("price", parseFloat(newProduct.price));
      formData.append("category", newProduct.category.trim());
      formData.append("restaurant", targetRestId);
      formData.append("user", userId);

      if (newProduct.imageFile) {
        formData.append("image", newProduct.imageFile);
      }

      const response = await authFetch.post("/products", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const savedProduct = response?.data?.product || response?.data?.data || response?.data;

      if (savedProduct) {
        setProducts((prev) => [savedProduct, ...prev]);
        setNewProduct({
          name: "",
          description: "",
          price: "",
          category: "",
          imageFile: null
        });
        setIsModalOpen(false);
        toast.success("Producto creado con éxito");
      }
    } catch (err) {
      console.error("Error al crear producto:", err);
      toast.error("No se pudo guardar el producto");
    }
  };

  const handleDeleteProduct = async (productOrId) => {
    const id = typeof productOrId === "object" 
      ? productOrId?._id || productOrId?.id 
      : productOrId;

    if (!id) {
      toast.error("ID de producto no válido");
      return;
    }

    try {
      await authFetch.delete(`/products/${id}`);
      setProducts((prev) => prev.filter((p) => (p._id || p.id) !== id));
      toast.success("Producto eliminado correctamente");
    } catch (err) {
      console.error("Error al eliminar producto:", err);
      if (err?.response?.status === 404) {
        setProducts((prev) => prev.filter((p) => (p._id || p.id) !== id));
        toast.info("El producto ya no existía en el servidor.");
        return;
      }
      toast.error("No se pudo eliminar el producto");
    }
  };

  // 🟢 FILTRAR EXCLUSIVAMENTE LOS PEDIDOS DEL RESTAURANTE CON ESTADO ENTREGADO
  const deliveredOrders = (orders || []).filter((ord) => {
    const st = (ord?.status || "").toUpperCase();
    return st === "DELIVERED" || st === "ENTREGADO";
  });

  // 🟢 CALCULAR VENTAS DEL DÍA SOLO DE LOS PEDIDOS ENTREGADOS
  const totalVentasHoy = deliveredOrders.reduce(
    (sum, ord) => sum + (parseFloat(ord?.total) || 0),
    0
  );

  const existingCategories = [
    ...new Set((products || []).map((p) => p?.category || p?.categoria).filter(Boolean))
  ];

  const categoriesList = ["all", ...existingCategories];

  const filteredProducts = (products || []).filter((p) => {
    const productName = p?.name || p?.nombre || "";
    const productCategory = p?.category || p?.categoria || "";

    const matchesSearch = productName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" ||
      productCategory.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const filteredOrders = (orders || []).filter((ord) => {
    if (orderStatusFilter === "all") return true;
    const st = (ord.status || "").toUpperCase();
    if (orderStatusFilter === "PENDIENTE") return st === "PENDING" || st === "PENDIENTE";
    if (orderStatusFilter === "EN_PREPARACION") return st === "PREPARING" || st === "EN_PREPARACION";
    if (orderStatusFilter === "LISTO") return st === "READY" || st === "LISTO";
    if (orderStatusFilter === "ENTREGADO") return st === "DELIVERED" || st === "ENTREGADO";
    return st === orderStatusFilter;
  });

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: "1.2rem" }}>
        Cargando portal de aliado...
      </div>
    );
  }

  return (
    <div className="rappi-portal-wrapper">
      <ToastContainer position="bottom-right" autoClose={3000} />

      <header className="rappi-navbar">
        <div className="navbar-left-group">
          <div className="navbar-brand">
            <div className="brand-logo-container">
              <img
                src={finalImageUrl}
                alt={restaurantName}
                className="brand-logo-img"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
                }}
              />
            </div>
            <div className="brand-info">
              <span className="partner-badge">RappiAliados</span>
              <span className="portal-type">{restaurantName}</span>
            </div>
          </div>

          <nav className="navbar-links">
            <button
              className={`nav-link ${activeTab === "orders" ? "active" : ""}`}
              onClick={() => setActiveTab("orders")}
            >
              <ShoppingBag size={18} />
              <span>Pedidos</span>
              <span className="live-counter">{orders.length}</span>
            </button>
            <button
              className={`nav-link ${activeTab === "menu" ? "active" : ""}`}
              onClick={() => setActiveTab("menu")}
            >
              <Utensils size={18} />
              <span>Mi Menú</span>
            </button>
          </nav>
        </div>

        <div className="navbar-user-actions">
          <button
            className={`store-status ${isOpen ? "abierto" : "cerrado"}`}
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className="status-indicator"></span>
            <span>{isOpen ? "TIENDA ABIERTA" : "TIENDA CERRADA"}</span>
          </button>
          <button
            className="btn-logout-icon"
            title="Cerrar sesión"
            onClick={() => logout && logout("restaurant")}
          >
            <Power size={18} />
          </button>
        </div>
      </header>

      <main className="rappi-content-body">
        {/* PEDIDOS */}
        {activeTab === "orders" && (
          <section className="restaurant-orders-module">
            <div className="module-title-bar">
              <div className="title-left">
                <div className="icon-wrapper"><ShoppingBag size={22} /></div>
                <div>
                  <h2>Pedidos en Tiempo Real</h2>
                  <p>Gestiona la preparación, empaque y despacho de las órdenes.</p>
                </div>
              </div>

              <div className="orders-status-filters">
                {[
                  { key: "all", label: "Todos" },
                  { key: "PENDIENTE", label: "Pendientes" },
                  { key: "EN_PREPARACION", label: "En Cocina" },
                  { key: "LISTO", label: "Listos" },
                  { key: "ENTREGADO", label: "Completados" }
                ].map((filter) => (
                  <button
                    key={filter.key}
                    className={`filter-btn ${orderStatusFilter === filter.key ? "active" : ""}`}
                    onClick={() => setOrderStatusFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="orders-cards-list">
              {filteredOrders.length === 0 ? (
                <div className="rappi-empty-state" style={{ gridColumn: "1 / -1" }}>
                  <div className="empty-illustration"><ShoppingBag size={36} /></div>
                  <h3>No hay pedidos {orderStatusFilter !== "all" ? "en este estado" : "activos"}</h3>
                  <p>Los nuevos pedidos aparecerán aquí automáticamente.</p>
                </div>
              ) : (
                filteredOrders.map((ord, idx) => {
                  const currentStatus = (ord.status || "PENDING").toUpperCase();
                  const statusClass = currentStatus.toLowerCase().replace("_", "-");
                  const itemsList = ord.products || ord.items || ord.orderItems || [];

                  const isPending = currentStatus === "PENDING" || currentStatus === "PENDIENTE";
                  const isPreparing = currentStatus === "PREPARING" || currentStatus === "EN_PREPARACION";
                  const isReady = currentStatus === "READY" || currentStatus === "LISTO";

                  // EXTRACCIÓN DE DATOS DE CLIENTE
                  const userObj = ord.user || ord.client || ord.customer;
                  
                  const userFirstName = userObj?.firstName || userObj?.firstname || userObj?.nombre || "";
                  const userLastName = userObj?.lastName || userObj?.lastname || userObj?.apellido || "";
                  const userCombinedName = `${userFirstName} ${userLastName}`.trim();

                  let clientFullName =
                    (userCombinedName !== "" ? userCombinedName : null) ||
                    userObj?.name ||
                    userObj?.username ||
                    ord.clientName ||
                    ord.customerName;

                  if (!clientFullName || clientFullName === "Cliente Rappi") {
                    clientFullName = userObj?.email ? userObj.email.split("@")[0] : "Cliente Rappi";
                  }

                  const clientPhoneNumber =
                    ord.customerPhone ||
                    ord.phone ||
                    userObj?.phone ||
                    userObj?.telefono ||
                    "";

                  return (
                    <div key={ord._id || ord.id || idx} className={`order-manage-card status-${statusClass}`}>
                      <div className="order-header-row">
                        <div className="order-id-group">
                          <span className="order-number">#{ord.code || (ord._id ? ord._id.slice(-5).toUpperCase() : `ORD-${9480 + idx}`)}</span>
                          <span className="order-time">
                            {ord.createdAt ? new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Hace unos mins"}
                          </span>
                        </div>
                        <span className={`status-pill pill-${statusClass}`}>
                          {currentStatus}
                        </span>
                      </div>

                      <div className="order-client-info">
                        <p className="client-name">👤 {clientFullName}</p>
                        <p className="client-address">📍 {ord.address || "Para llevar / Pick Up"}</p>
                        {clientPhoneNumber && <p className="client-phone">📞 {clientPhoneNumber}</p>}
                      </div>

                      <div className="order-items-scroll">
                        <span className="items-header">Detalle del Pedido:</span>
                        <ul className="order-products-list">
                          {itemsList.length > 0 ? (
                            itemsList.map((item, i) => (
                              <li key={i} className="product-item">
                                <span className="qty">{item.quantity || item.cantidad || 1}x</span>
                                <span className="p-name">{item.product?.name || item.name || item.nombre || "Producto"}</span>
                                <span className="p-price">S/ {parseFloat(item.price || item.precio || 0).toFixed(2)}</span>
                              </li>
                            ))
                          ) : (
                            <li className="product-item">
                              <span className="qty">1x</span>
                              <span className="p-name">Consumo General</span>
                            </li>
                          )}
                        </ul>
                      </div>

                      <div className="order-footer-row">
                        <div className="order-total-price">
                          <small>Total a cobrar:</small>
                          <span>S/ {parseFloat(ord.total || 0).toFixed(2)}</span>
                        </div>

                        <div className="order-actions-btns">
                          {isPending && (
                            <button className="btn-order-action accept" onClick={() => handleUpdateOrderStatus(ord._id || ord.id, "PREPARING")}>
                              Aceptar y Preparar
                            </button>
                          )}
                          {isPreparing && (
                            <button className="btn-order-action ready" onClick={() => handleUpdateOrderStatus(ord._id || ord.id, "READY")}>
                              Marcar Listo
                            </button>
                          )}
                          {isReady && (
                            <button className="btn-order-action complete" onClick={() => handleUpdateOrderStatus(ord._id || ord.id, "DELIVERED")}>
                              Entregar Pedido
                            </button>
                          )}
                          {currentStatus !== "DELIVERED" && currentStatus !== "CANCELLED" && (
                            <button className="btn-order-action cancel" onClick={() => handleUpdateOrderStatus(ord._id || ord.id, "CANCELLED")}>
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* MENÚ */}
        {activeTab === "menu" && (
          <section className="restaurant-menu-module">
            <div className="restaurant-hero-card">
              <div className="hero-left">
                <div className="restaurant-avatar-box">
                  <img
                    src={finalImageUrl}
                    alt={restaurantName}
                    className="restaurant-avatar-img"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
                    }}
                  />
                </div>
                <div className="restaurant-details">
                  <span className="category-tag">SOCIO PREMIUM</span>
                  <h2>{restaurantName}</h2>
                  <p>Administra tu menú fácilmente.</p>
                </div>
              </div>
            </div>

            <div className="metrics-dashboard-grid">
              <div className="metric-box">
                <div className="metric-header">
                  <span className="metric-title">Total Platos</span>
                  <div className="metric-icon green"><Utensils size={18} /></div>
                </div>
                <div className="metric-value">{products.length}</div>
                <div className="metric-subtext positive">Activos en la carta</div>
              </div>

              {/* 🟢 MÉTRICA DE VENTAS ACTUALIZADA PARA CONTABILIZAR ÚNICAMENTE PEDIDOS ENTREGADOS */}
              <div className="metric-box">
                <div className="metric-header">
                  <span className="metric-title">Ventas Hoy</span>
                  <div className="metric-icon orange">$</div>
                </div>
                <div className="metric-value">S/ {totalVentasHoy.toFixed(2)}</div>
                <div className="metric-subtext neutral">
                  {deliveredOrders.length} {deliveredOrders.length === 1 ? "pedido entregado" : "pedidos entregados"}
                </div>
              </div>
            </div>

            <div className="menu-toolbar">
              <div className="search-and-filters">
                <div className="search-input-box">
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="category-filter-pills">
                  {categoriesList.map((cat) => (
                    <button
                      key={cat}
                      className={`pill-btn ${selectedCategory.toLowerCase() === cat.toLowerCase() ? "active" : ""}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat === "all" ? "Todos" : cat}
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn-add-product-rappi" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} /> Nuevo Producto
              </button>
            </div>

            <div className="products-card-grid">
              {filteredProducts.length === 0 ? (
                <div className="rappi-empty-state" style={{ gridColumn: "1 / -1" }}>
                  <p>No se encontraron productos.</p>
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <div key={product._id || product.id} className="rappi-product-card">
                    <div className="card-image-box">
                      <img
                        src={getImageUrl(product)}
                        alt=""
                        className="product-bg-blur"
                        aria-hidden="true"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
                        }}
                      />
                      <img
                        src={getImageUrl(product)}
                        alt={product.name || product.nombre}
                        className="product-real-img"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
                        }}
                      />
                      <span className="card-category-tag">
                        {product.category || product.categoria || "Menú"}
                      </span>
                    </div>

                    <div className="card-body">
                      <h4 className="product-title">{product.name || product.nombre}</h4>
                      <p className="product-desc">{product.description || product.descripcion}</p>
                      <div className="card-footer-row">
                        <div className="price-tag">
                          <small>S/</small>
                          <span>{parseFloat(product.price || product.precio || 0).toFixed(2)}</span>
                        </div>
                        <button
                          className="btn-trash-action"
                          onClick={() => handleDeleteProduct(product)}
                          title="Eliminar producto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      {/* MODAL PARA CREACIÓN DE PRODUCTOS */}
      {isModalOpen && (
        <div className="rappi-modal-backdrop">
          <div className="rappi-modal-box">
            <div className="modal-top-bar">
              <h3>Agregar Producto</h3>
              <button 
                className="close-modal-btn" 
                onClick={() => setIsModalOpen(false)}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="rappi-modal-form">
              <div className="form-field">
                <label>Nombre del Producto *</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-2col">
                <div className="form-field">
                  <label>Precio (S/) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Categoría *</label>
                  <input
                    type="text"
                    placeholder="Ej: Cebiches, Arroces, Bebidas"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Imagen del Producto</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewProduct({ ...newProduct, imageFile: e.target.files[0] })}
                />
              </div>

              <div className="form-field">
                <label>Descripción</label>
                <textarea
                  rows="3"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                ></textarea>
              </div>

              <div className="modal-actions-bar">
                <button 
                  type="button" 
                  className="btn-cancel-modal" 
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-confirm-rappi">
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RestaurantDashboardPage;