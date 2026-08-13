/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import useAuth from "./AuthContext"; 
import api from "@/api/axios";

export const DriverContext = createContext(null);

export const DriverProvider = ({ children }) => {
  const { user } = useAuth();

  const [isOnline, setIsOnline] = useState(() => {
    const saved = localStorage.getItem("driver_is_online");
    return saved ? JSON.parse(saved) : false;
  });
  const [activeOrder, setActiveOrder] = useState(null);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [stats, setStats] = useState({
    todayEarnings: 0,
    completedTodayCount: 0,
    dailyGoal: 10,
    rating: 5.0,
    reviewsCount: 48,
  });

  useEffect(() => {
    localStorage.setItem("driver_is_online", JSON.stringify(isOnline));
  }, [isOnline]);

  const refetchDriverData = useCallback(() => {
    setReloadTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDriverData = async () => {
      // GUARDIA 1: Verificar Token
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("access") ||
        localStorage.getItem("auth_token_jwt");

      if (!token || token === "undefined" || token === "null") {
        if (isMounted) setLoading(false);
        return;
      }

      // GUARDIA 2: Verificar usuario
      if (!user || typeof user !== "object") {
        if (isMounted) setLoading(false);
        return;
      }

      // GUARDIA 3: Roles
      const userRole = String(user.role || "").toLowerCase();
      const allowedRoles = ["driver", "repartidor", "delivery", "admin"];
      if (userRole && !allowedRoles.includes(userRole)) {
        if (isMounted) setLoading(false);
        return;
      }

      if (isMounted) setLoading(true);

      try {
        const { data: rawData } = await api.get("/orders?page=1&limit=50");
        const allOrders = rawData.docs || (Array.isArray(rawData) ? rawData : rawData.data || []);

        if (isMounted) {
          const possibleUserIds = [
            user?._id,
            user?.id,
            user?.user_id,
            user?.driverId,
            user?.driver?._id
          ].filter(Boolean).map(id => String(id));

          // 1. ÓRDENES DISPONIBLES
          const available = allOrders.filter((o) => {
            const orderStatus = String(o.status || "").toLowerCase();
            const isFinished = ["delivered", "cancelled", "completed", "entregado", "cancelado"].includes(orderStatus);

            const assignedDriver = o.deliveryDriver || o.driver;
            const assignedDriverId = String(
              assignedDriver?._id || assignedDriver?.id || (typeof assignedDriver === "string" ? assignedDriver : "")
            );

            const isUnassigned =
              !assignedDriver ||
              assignedDriverId === "" ||
              assignedDriverId === "null" ||
              assignedDriverId === "undefined";

            return !isFinished && isUnassigned;
          });

          setAvailableOrders(available);

          // 2. ÓRDENES ASIGNADAS AL REPARTIDOR ACTUAL
          const myOrders = allOrders.filter((o) => {
            const assignedDriver = o.deliveryDriver || o.driver;
            if (!assignedDriver) return false;

            const assignedId = String(
              assignedDriver?._id || assignedDriver?.id || (typeof assignedDriver === "string" ? assignedDriver : "")
            );

            return possibleUserIds.includes(assignedId);
          });

          // Buscar Orden Activa
          const active = myOrders.find((o) => {
            const st = String(o.status || "").toLowerCase();
            return ["accepted", "in_transit", "in_delivery", "ready", "on_the_way", "en_camino", "preparing", "pending"].includes(st);
          });
          
          setActiveOrder(active || null);

          // Buscar Órdenes Entregadas
          const doneToday = myOrders.filter((o) => {
            const st = String(o.status || "").toLowerCase();
            return st === "delivered" || st === "entregado" || st === "completed";
          });
          
          setCompletedOrders(doneToday);

          const earnings = doneToday.reduce(
            (acc, item) => acc + Number(item.deliveryFee || item.total || 0),
            0
          );

          setStats((prev) => ({
            ...prev,
            todayEarnings: earnings,
            completedTodayCount: doneToday.length,
          }));
        }
      } catch (err) {
        if (err.response?.status !== 401 && err.response?.status !== 403) {
          console.error("Error al consultar las órdenes:", err.response?.data || err.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDriverData();

    return () => {
      isMounted = false;
    };
  }, [user, reloadTrigger]);

  const toggleAvailability = () => {
    setIsOnline((prev) => !prev);
  };

  const acceptOrder = async (orderId) => {
    try {
      const currentUserId = user?._id || user?.id || user?.user_id;
      if (!currentUserId) return false;

      await api.patch(`/orders/${orderId}`, {
        status: "in_transit",
        deliveryDriver: currentUserId,
      });

      refetchDriverData();
      return true;
    } catch (error) {
      console.error("Error al aceptar pedido:", error.response?.data || error.message);
      return false;
    }
  };

  const completeOrder = async (orderId) => {
    try {
      const targetId = orderId || activeOrder?._id || activeOrder?.id;
      if (!targetId) return false;

      await api.patch(`/orders/${targetId}`, { status: "delivered" });

      setActiveOrder(null);
      refetchDriverData();
      return true;
    } catch (error) {
      console.error("Error al completar entrega:", error.response?.data || error.message);
      return false;
    }
  };

  const value = {
    isOnline,
    setIsOnline,
    activeOrder,
    setActiveOrder,
    availableOrders,
    completedOrders,
    driverLocation,
    setDriverLocation,
    loading,
    stats,
    toggleAvailability,
    acceptOrder,
    completeOrder,
    refetchDriverData,
  };

  return <DriverContext.Provider value={value}>{children}</DriverContext.Provider>;
};

export const useDriver = () => {
  const context = useContext(DriverContext);
  if (!context) {
    throw new Error("useDriver debe usarse dentro de un DriverProvider");
  }
  return context;
};

export default DriverContext;