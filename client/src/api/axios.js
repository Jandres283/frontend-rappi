import axios from "axios";
import { ENV } from "@/utils/constants";

const instance = axios.create({
  baseURL: ENV.API_URL,
});

// Interceptor para inyectar Token de forma inteligente según el Rol
instance.interceptors.request.use(
  (config) => {
    // Usamos el helper dinámico de constants.js
    const token =
      ENV.GET_TOKEN() ||
      localStorage.getItem(ENV?.STORAGE?.TOKEN) ||
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("auth_token_jwt");

    if (token) {
      const cleanToken = token.replace(/^"(.*)"$/, "$1");

      config.headers.Authorization = cleanToken.startsWith("Bearer ")
        ? cleanToken
        : `Bearer ${cleanToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para limpiar sesión expirada de forma automática
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || "";

    const isAuthEndpoint =
      requestUrl.includes("/user/login") ||
      requestUrl.includes("/users/login") ||
      requestUrl.includes("/user/register") ||
      requestUrl.includes("/users/register") ||
      requestUrl.includes("/user/me") ||
      requestUrl.includes("/login");

    if ((status === 401 || status === 403) && !isAuthEndpoint) {
      console.warn("Sesión caducada o token inválido. Limpiando credenciales...");

      if (ENV?.STORAGE?.TOKEN) localStorage.removeItem(ENV.STORAGE.TOKEN);
      if (ENV?.STORAGE?.USER) localStorage.removeItem(ENV.STORAGE.USER);
      
      localStorage.removeItem("admin_token_jwt");
      localStorage.removeItem("client_token_jwt");
      localStorage.removeItem("driver_token_jwt");
      localStorage.removeItem("restaurant_token_jwt");
      localStorage.removeItem("token");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("auth_token_jwt");

      const currentPath = window.location.pathname;
      if (!currentPath.includes("/login") && !currentPath.includes("/register")) {
        if (currentPath.startsWith("/restaurant")) {
          window.location.href = "/restaurant/login";
        } else if (currentPath.startsWith("/admin")) {
          window.location.href = "/admin/login";
        } else {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default instance;