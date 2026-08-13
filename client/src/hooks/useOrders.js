import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { ENV } from '@/utils/constants';

// URLs dinámicas tomadas desde tus constantes globales
const API_URL = ENV.API_URL;
const SOCKET_URL = ENV.SERVER_HOST || ENV.BASE_PATH;

// Conexión dinámica a Socket.io
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
});

// Helper dinámico para tokens por rol
const getAuthHeaders = () => {
  const token =
    (ENV.GET_TOKEN && ENV.GET_TOKEN()) ||
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('admin_token_jwt');

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : {}),
  };
};

export const useOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/orders`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        const ordersList = Array.isArray(data) ? data : data.docs || [];
        setOrders(ordersList);
      }
    } catch (err) {
      console.error('Error cargando órdenes desde el backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialOrders = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/orders`, {
          headers: getAuthHeaders(),
        });

        if (res.ok) {
          const data = await res.json();
          const ordersList = Array.isArray(data) ? data : data.docs || [];
          setOrders(ordersList);
        }
      } catch (err) {
        console.error('Error cargando órdenes iniciales:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialOrders();

    // ⚡ 1. Escuchar cuando el Cliente genera un nuevo pedido
    const handleNewOrder = (newOrder) => {
      if (!newOrder || (!newOrder._id && !newOrder.id)) return;

      setOrders((prevOrders) => {
        const exists = prevOrders.some(
          (order) => (order._id || order.id) === (newOrder._id || newOrder.id)
        );
        if (exists) return prevOrders;
        return [newOrder, ...prevOrders]; // Lo inserta arriba de la lista
      });
    };

    // ⚡ 2. Escuchar cuando Cambia el Estado (Restaurante o Driver)
    const handleOrderUpdated = (updatedOrder) => {
      if (!updatedOrder || (!updatedOrder._id && !updatedOrder.id)) return;

      setOrders((prevOrders) => {
        const exists = prevOrders.some(
          (order) => (order._id || order.id) === (updatedOrder._id || updatedOrder.id)
        );

        if (!exists) {
          return [updatedOrder, ...prevOrders];
        }

        return prevOrders.map((order) =>
          (order._id || order.id) === (updatedOrder._id || updatedOrder.id)
            ? updatedOrder
            : order
        );
      });
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_updated', handleOrderUpdated);

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_updated', handleOrderUpdated);
    };
  }, []);

  const updateOrderStatus = async (orderId, newStatus, deliveryDriverId = null) => {
    try {
      // Cambio de estado optimista en pantalla
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          (order._id || order.id) === orderId
            ? { ...order, status: newStatus }
            : order
        )
      );

      const bodyData = { status: newStatus };
      if (deliveryDriverId) bodyData.deliveryDriver = deliveryDriverId;

      const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.msg || 'No se pudo actualizar el estado de la orden');
      }

      const updatedOrderFromDb = await res.json();

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          (order._id || order.id) === orderId ? updatedOrderFromDb : order
        )
      );

      return { success: true, data: updatedOrderFromDb };
    } catch (error) {
      console.error('Error al actualizar el estado:', error.message);
      refetchOrders();
      alert(`Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  };

  const updateOrderDetails = async (updatedOrderData) => {
    const orderId = updatedOrderData._id || updatedOrderData.id;
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedOrderData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.msg || 'Error al actualizar detalles de la orden');
      }

      const updatedOrderFromDb = await res.json();

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          (order._id || order.id) === orderId ? updatedOrderFromDb : order
        )
      );

      return { success: true, data: updatedOrderFromDb };
    } catch (error) {
      console.error('Error actualizando detalles:', error.message);
      refetchOrders();
      return { success: false, error: error.message };
    }
  };

  return {
    orders,
    loading,
    refetchOrders,
    updateOrderStatus,
    updateOrderDetails,
  };
};