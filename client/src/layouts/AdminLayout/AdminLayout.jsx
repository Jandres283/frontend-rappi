import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { 
  LuShieldCheck, 
  LuUser, 
  LuLogOut, 
  LuBike, 
  LuUtensils, 
  LuPackage, 
  LuNewspaper, 
  LuMail, 
  LuUsers, 
  LuContact 
} from "react-icons/lu";
import "./AdminLayout.scss";

export const AdminLayout = () => {
  const navigate = useNavigate();
  const adminEmail = localStorage.getItem("adminEmail") || "admin@protecrappi.com";

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("adminEmail");
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="admin-layout">
      {/* Header Superior Moderno */}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-section">
            <div className="logo-badge">
              <LuShieldCheck className="logo-icon" />
            </div>
            <div className="brand-titles">
              <h1>ControlRappi</h1>
              <span>Panel Administrativo</span>
            </div>
          </div>

          <div className="user-section">
            <div className="user-pill">
              <LuUser className="user-icon" />
              <span className="user-email">{adminEmail}</span>
            </div>
            <button type="button" onClick={handleLogout} className="logout-btn cursor-pointer">
              <LuLogOut className="logout-icon" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navegación Horizontal por Pestañas */}
      <nav className="horizontal-nav">
        <div className="nav-container">
          <NavLink 
            to="/admin/orders" 
            className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}
          >
            <LuBike className="tab-icon" />
            <span>Pedidos</span>
          </NavLink>

          <NavLink 
            to="/admin/restaurants" 
            className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}
          >
            <LuUtensils className="tab-icon" />
            <span>Restaurantes</span>
          </NavLink>

          <NavLink 
            to="/admin/products" 
            className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}
          >
            <LuPackage className="tab-icon" />
            <span>Productos</span>
          </NavLink>

          <NavLink 
            to="/admin/news" 
            className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}
          >
            <LuNewspaper className="tab-icon" />
            <span>Noticias</span>
          </NavLink>

          <NavLink 
            to="/admin/contacts" 
            className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}
          >
            <LuMail className="tab-icon" />
            <span>Contactos</span>
          </NavLink>

          <NavLink 
            to="/admin/users" 
            className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}
          >
            <LuUsers className="tab-icon" />
            <span>Usuarios</span>
          </NavLink>

          <NavLink 
            to="/admin/clients" 
            className={({ isActive }) => `nav-tab ${isActive ? "active" : ""}`}
          >
            <LuContact className="tab-icon" />
            <span>Clientes</span>
          </NavLink>
        </div>
      </nav>

      {/* Área del Contenido Principal */}
      <main className="main-content">
        <div className="content-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;