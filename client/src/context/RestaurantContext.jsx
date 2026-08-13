/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks";
import { getImageUrl } from "@/utils";
import api from "@/api/axios";

export const RestaurantContext = createContext(null);

export const RestaurantProvider = ({ children }) => {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [currentRestaurant, setCurrentRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [isOpen, setIsOpen] = useState(true);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const userId = user?._id || user?.id;

  const refetchData = useCallback(() => {
    setReloadTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchDataFromDB = async () => {
      try {
        setLoading(true);

        // 1. Obtener lista global de restaurantes
        const resResto = await api.get("/restaurants");
        const data = resResto.data;
        const rawList = data.docs || (Array.isArray(data) ? data : []);

        const formattedList = rawList.map((resto) => ({
          ...resto,
          image: resto.image ? getImageUrl(resto.image) : null,
          deliveryFee:
            resto.deliveryFee === 0 || !resto.deliveryFee
              ? "Gratis"
              : `S/ ${Number(resto.deliveryFee).toFixed(2)}`,
          deliveryTime: resto.estimatedTime || "25-35 min",
          rating: resto.rating || 4.8,
        }));

        if (isMounted) {
          setRestaurants(formattedList);

          if (formattedList.length > 0) {
            if (userId) {
              const myId = String(userId);

              const myResto = formattedList.find((r) => {
                const restoUser = String(r.user?._id || r.user || r.user_id || "");
                return restoUser === myId;
              });

              setCurrentRestaurant(myResto || formattedList[0]);
            } else {
              setCurrentRestaurant(formattedList[0]);
            }
          }
        }

        // 2. Obtener productos/platillos
        try {
          const resProducts = await api.get("/products");
          const productsData = resProducts.data;
          const productsList = productsData.docs || (Array.isArray(productsData) ? productsData : []);

          const formattedProducts = productsList.map((product) => ({
            ...product,
            image: product.image ? getImageUrl(product.image) : null,
          }));

          if (isMounted) setDishes(formattedProducts);
        } catch (prodError) {
          console.warn("No se pudieron cargar los productos:", prodError);
          if (isMounted) setDishes([]);
        }

      } catch (error) {
        console.warn("Error al consultar la API backend de restaurantes:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDataFromDB();

    return () => {
      isMounted = false;
    };
  }, [reloadTrigger, userId]);

  const updateOrderStatus = (orderId, status) => {
    setPendingOrders((prev) =>
      prev.map((order) =>
        (order.id || order._id) === orderId ? { ...order, status } : order
      )
    );
  };

  const value = {
    restaurants,
    setRestaurants,
    currentRestaurant,
    setCurrentRestaurant,
    dishes,
    setDishes,
    loading,
    refetchData,
    refetchRestaurants: refetchData,
    pendingOrders,
    setPendingOrders,
    isOpen,
    setIsOpen,
    updateOrderStatus,
  };

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error("useRestaurant debe usarse dentro de un RestaurantProvider");
  }
  return context;
};