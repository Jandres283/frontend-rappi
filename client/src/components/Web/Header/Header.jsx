import { useState, useEffect, useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import { 
  FiShoppingBag, 
  FiSearch, 
  FiUser, 
  FiPackage, 
  FiMenu, 
  FiX 
} from "react-icons/fi";

// Importaciones de contextos
import useAuth from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

import { UserMenu } from "../UserMenu/UserMenu";
import { ProfileModal } from "../ProfileModal/ProfileModal";
import { OrderHistoryModal } from "../OrderHistoryModal/OrderHistoryModal";
import "./Header.scss";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

const getUserDisplayName = (userData) => {
  if (!userData) return "Usuario";
  
  const extractedName = 
    userData.firstName ||
    userData.firstname ||
    userData.nombre ||
    userData.name ||
    userData.first_name ||
    userData.user?.firstName ||
    userData.user?.nombre ||
    (userData.email ? userData.email.split("@")[0] : null);

  return extractedName || "Usuario";
};

const Header = ({ 
  searchTerm = "", 
  onSearchChange, 
  onOpenAuth 
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const { user, token, isAuthenticated, logout, updateUser } = useAuth();
  const { openCart, totalItems } = useCart();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);

  // FILTRO CLAVE: La web pública solo debe considerar logueado al ROL CLIENTE
  const isClientRole = user && (String(user.role).toLowerCase() === "client" || String(user.role).toLowerCase() === "cliente");
  const isClientAuthenticated = isAuthenticated && isClientRole;

  const userId = user?._id || user?.id || user?.user;

  const updateUserRef = useRef(updateUser);
  const userRef = useRef(user);

  useEffect(() => {
    updateUserRef.current = updateUser;
    userRef.current = user;
  }, [updateUser, user]);

  // Sincronización de perfil de usuario SOLO si es CLIENTE
  useEffect(() => {
    let isMounted = true;

    const fetchFullUserProfile = async () => {
      if (!token || !userId || !isClientRole) return;

      try {
        let userRes = await fetch(`${API_URL}/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!userRes.ok) {
          userRes = await fetch(`${API_URL}/user/${userId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }

        if (userRes.ok && isMounted) {
          const data = await userRes.json();
          const fetchedUserData = data.user || data.userData || data.client || data;

          const displayName = 
            getUserDisplayName(fetchedUserData) !== "Usuario" 
              ? getUserDisplayName(fetchedUserData) 
              : getUserDisplayName(userRef.current);

          const mergedUser = {
            ...userRef.current,
            ...fetchedUserData,
            firstName: displayName,
            firstname: displayName,
            nombre: displayName,
            name: displayName
          };
          
          if (typeof updateUserRef.current === "function") {
            updateUserRef.current(mergedUser);
          }
        }
      } catch (error) {
        console.error("Error al sincronizar el perfil:", error);
      }
    };

    if (isClientAuthenticated && token && userId) {
      fetchFullUserProfile();
    }

    return () => {
      isMounted = false;
    };
  }, [isClientAuthenticated, token, userId, isClientRole]);

  const handleToggleCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof openCart === "function") {
      openCart();
    }
  };

  const handleOpenAuthModal = (e) => {
    e?.preventDefault();
    if (typeof onOpenAuth === "function") {
      onOpenAuth();
    }
  };

  const handleLogout = () => {
    logout();
    setShowProfileModal(false);
    setShowOrdersModal(false);
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const displayName = getUserDisplayName(user);
  const normalizedUser = isClientAuthenticated ? {
    ...user,
    firstName: displayName,
    firstname: displayName,
    nombre: displayName,
    name: displayName
  } : null;

  return (
    <>
      <header className="web-header">
        <div className="header-container">
          
          <div className="header-brand-wrapper">
            <button 
              type="button"
              className="btn-mobile-menu" 
              onClick={toggleMobileMenu} 
              aria-label="Menú de navegación"
            >
              {isMobileMenuOpen ? <FiX /> : <FiMenu />}
            </button>

            <Link to="/" className="header-logo" onClick={closeMobileMenu}>
              <FiPackage className="logo-icon" /> 
              <span className="logo-text gradient-brand">
                Rappi
              </span>
            </Link>
          </div>

          <nav className={`header-nav ${isMobileMenuOpen ? "is-open" : ""}`}>
            <NavLink 
              to="/" 
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              onClick={closeMobileMenu}
            >
              Inicio
            </NavLink>
            <NavLink 
              to="/restaurants" 
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              onClick={closeMobileMenu}
            >
              Restaurantes
            </NavLink>
            <NavLink 
              to="/news" 
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              onClick={closeMobileMenu}
            >
              Noticias
            </NavLink>
            <NavLink 
              to="/contact" 
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              onClick={closeMobileMenu}
            >
              Contacto
            </NavLink>
          </nav>

          {onSearchChange && (
            <div className="header-search">
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Buscar platillos o restaurantes..."
                value={searchTerm || ""}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          )}

          <div className="header-actions">
            <button 
              type="button" 
              className="btn-cart-toggle" 
              onClick={handleToggleCart} 
              title="Ver Carrito"
            >
              <FiShoppingBag />
              {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
            </button>

            {/* MOSTRAR USERMENU SOLO SI ES CLIENTE */}
            {isClientAuthenticated && normalizedUser ? (
              <UserMenu 
                user={normalizedUser}
                onLogout={handleLogout}
                onOpenProfile={() => setShowProfileModal(true)}
                onOpenOrders={() => setShowOrdersModal(true)}
              />
            ) : (
              <button 
                type="button" 
                className="btn-auth" 
                onClick={handleOpenAuthModal}
              >
                <FiUser className="btn-auth-icon" />
                <span>Ingresar</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {isClientAuthenticated && (
        <>
          <ProfileModal 
            key={user?._id || user?.id || "profile-modal"}
            isOpen={showProfileModal} 
            onClose={() => setShowProfileModal(false)} 
            user={normalizedUser}
          />

          <OrderHistoryModal 
            isOpen={showOrdersModal} 
            onClose={() => setShowOrdersModal(false)} 
            user={normalizedUser}
          />
        </>
      )}
    </>
  );
};

export default Header;