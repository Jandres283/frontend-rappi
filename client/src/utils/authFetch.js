import axios from "axios";
import { ENV } from "./constants";

const authFetch = axios.create({
  baseURL: ENV.BASE_API,
});

// Interceptor para enviar el Token estándar
authFetch.interceptors.request.use(
  (config) => {
    let token = ENV.GET_TOKEN();

    if (token) {
      token = token.replace(/^"(.*)"$/, "$1").trim();
      // Solo enviamos Authorization (formato aceptado por CORS y por ensureAuth)
      config.headers.Authorization = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

authFetch.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("🔒 Petición no autorizada o token caducado.");
    }
    return Promise.reject(error);
  }
);

export default authFetch;
export { authFetch };