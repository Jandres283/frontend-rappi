/* eslint-disable */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ENV } from "@/utils";

export const AuthContext = createContext(null);

const getRawApiUrl = () => {
  const url = ENV?.BASE_PATH || ENV?.API_URL || "http://localhost:3977/api";
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

const API_URL = getRawApiUrl();

const getRoleStorageKeys = (role = "client") => {
  const cleanRole = String(role).toLowerCase().trim();
  return {
    USER_KEY: `${cleanRole}_user_data`,
    TOKEN_KEY: `${cleanRole}_token_jwt`,
  };
};

const getTargetRoleFromLocation = () => {
  if (typeof window === "undefined") return "client";
  const path = window.location.pathname.toLowerCase();

  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/driver") || path.startsWith("/repartidor")) return "driver";
  if (path.startsWith("/restaurant") || path.startsWith("/socio")) return "restaurant";

  return "client";
};

const cleanAndFormatName = (rawName) => {
  if (!rawName || typeof rawName !== "string") return "";
  const cleaned = rawName.replace(/[0-9_.-]/g, " ").trim();
  if (!cleaned) return "";
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const normalizeUser = (rawData) => {
  if (!rawData) return null;

  let data = rawData;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (typeof data !== "object" || data === null) return null;

  const target =
    data.user?.client ||
    data.user?.profile ||
    data.client ||
    data.userData ||
    data.user ||
    data.data?.user ||
    data.data ||
    data;

  const rawFirstName =
    target.firstName ||
    target.firstname ||
    target.nombre ||
    target.nombres ||
    target.name ||
    target.first_name ||
    target.fullName ||
    target.fullname ||
    data.firstName ||
    data.firstname ||
    data.nombre ||
    data.name;

  let realName = cleanAndFormatName(rawFirstName);

  if (!realName) {
    const rawFallback =
      target.username ||
      data.username ||
      (target.email ? target.email.split("@")[0] : null) ||
      (data.email ? data.email.split("@")[0] : null);

    realName = cleanAndFormatName(rawFallback) || "Usuario";
  }

  const detectedRole = String(target.role || data.role || "client").toLowerCase().trim();

  return {
    ...target,
    firstName: realName,
    firstname: realName,
    nombre: realName,
    name: realName,
    role: detectedRole,
  };
};

const getInitialAuthState = () => {
  const currentRole = getTargetRoleFromLocation();
  const { USER_KEY, TOKEN_KEY } = getRoleStorageKeys(currentRole);

  try {
    const savedToken =
      localStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken");

    const savedUser =
      localStorage.getItem(USER_KEY) ||
      localStorage.getItem("user");

    if (savedToken && savedUser) {
      const parsedUser = normalizeUser(savedUser);
      if (parsedUser) {
        return { token: savedToken, user: parsedUser };
      }
    }
  } catch {
    // Silencioso
  }

  return { token: null, user: null };
};

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(getInitialAuthState);
  const [isLoading, setIsLoading] = useState(false);

  const { token, user } = authState;

  const fetchUserProfile = useCallback(async (authToken, userId, currentRole = "client") => {
    if (!authToken) return;

    const apiBase = API_URL.includes("/api") ? API_URL : `${API_URL}/api`;
    const endpoints = [
      `${apiBase}/users/${userId || "me"}`,
      `${apiBase}/auth/me`,
      `${apiBase}/clients/${userId || "me"}`,
      `http://localhost:3977/api/users/${userId || "me"}`,
      `http://localhost:3977/api/auth/me`,
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const profileData = await response.json();
          const extracted = profileData.user || profileData.client || profileData.data || profileData;

          if (extracted) {
            const normalized = normalizeUser(extracted);
            const { USER_KEY } = getRoleStorageKeys(normalized.role || currentRole);

            localStorage.setItem(USER_KEY, JSON.stringify(normalized));
            localStorage.setItem("user", JSON.stringify(normalized));

            if (normalized.role === getTargetRoleFromLocation()) {
              setAuthState((prev) => ({ ...prev, user: normalized }));
            }
            window.dispatchEvent(new Event("auth-change"));
            return;
          }
        }
      } catch {
        // Silencioso
      }
    }
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (token && user) {
        const hasValidName =
          user.firstName &&
          user.firstName.toLowerCase() !== "usuario" &&
          user.firstName.trim().length > 0;

        const userId = user.user_id || user.id || user._id;

        if (!hasValidName && userId) {
          await fetchUserProfile(token, userId, user.role);
        }
      }
    };

    loadProfile();
  }, [token, user, fetchUserProfile]);

  useEffect(() => {
    const handleAuthChange = () => {
      try {
        const newState = getInitialAuthState();
        setAuthState(newState);
      } catch (err) {
        console.error("Error al sincronizar auth state:", err);
      }
    };

    window.addEventListener("auth-change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);

    return () => {
      window.removeEventListener("auth-change", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  const login = useCallback(
    async (param1, param2) => {
      setIsLoading(true);
      try {
        let extractedToken = null;
        let extractedUser = null;

        if (param1 && typeof param1 === "object" && !param2) {
          extractedToken =
            param1.token ||
            param1.accessToken ||
            param1.access ||
            param1.access_token ||
            param1.auth_token_jwt ||
            param1.jwt;
          extractedUser = param1.user || param1.userData || param1.data || param1;
        } else if (param1 && param2) {
          if (typeof param1 === "string") {
            extractedToken = param1;
            extractedUser = param2;
          } else {
            extractedUser = param1;
            extractedToken = param2;
          }
        }

        if (!extractedToken || !extractedUser) {
          console.error("❌ Error en Login: Parámetros inválidos.", { param1, param2 });
          return;
        }

        const normalizedUser = normalizeUser(extractedUser);
        const { USER_KEY, TOKEN_KEY } = getRoleStorageKeys(normalizedUser.role);

        // Claves específicas por rol y globales
        localStorage.setItem(TOKEN_KEY, extractedToken);
        localStorage.setItem("token", extractedToken);
        localStorage.setItem("accessToken", extractedToken);

        localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
        localStorage.setItem("user", JSON.stringify(normalizedUser));

        setAuthState({ token: extractedToken, user: normalizedUser });

        const userId = extractedUser.user_id || extractedUser.id || extractedUser._id;
        if (userId) {
          await fetchUserProfile(extractedToken, userId, normalizedUser.role);
        }

        window.dispatchEvent(new Event("auth-change"));
      } catch (err) {
        console.error("Error al procesar el inicio de sesión:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchUserProfile]
  );

  const logout = useCallback(
    (specificRole = null) => {
      const targetRole = specificRole || user?.role || getTargetRoleFromLocation();

      if (targetRole) {
        const { USER_KEY, TOKEN_KEY } = getRoleStorageKeys(targetRole);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }

      localStorage.removeItem("token");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");

      setAuthState({ token: null, user: null });
      window.dispatchEvent(new Event("auth-change"));
    },
    [user]
  );

  const updateUser = useCallback((updatedData) => {
    setAuthState((prev) => {
      const base = prev.user || {};
      const merged = { ...base, ...updatedData };
      const normalized = normalizeUser(merged);

      try {
        const { USER_KEY } = getRoleStorageKeys(normalized.role);
        localStorage.setItem(USER_KEY, JSON.stringify(normalized));
        localStorage.setItem("user", JSON.stringify(normalized));
      } catch (err) {
        console.error("Error guardando usuario actualizado:", err);
      }

      return { ...prev, user: normalized };
    });

    window.dispatchEvent(new Event("auth-change"));
  }, []);

  const value = {
    user,
    setUser: (newUser) => setAuthState((prev) => ({ ...prev, user: newUser })),
    token,
    setToken: (newToken) => setAuthState((prev) => ({ ...prev, token: newToken })),
    role: user?.role || null,
    isAuthenticated: Boolean(token && user),
    isLoading,
    loading: isLoading,
    login,
    logout,
    updateUser,
    fetchUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de un AuthProvider");
  }
  return context;
};

export default useAuth;