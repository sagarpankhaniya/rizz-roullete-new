import axios from "axios";
import { clearAuthSession, getToken } from "./auth-storage";

export const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

const PUBLIC_AUTH_PATHS = [
  "/admin/auth/login",
  "/admin/auth/forgot-password",
  "/admin/auth/reset-password",
];

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let handlingUnauthorized = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url ?? "");
    const isPublicAuth = PUBLIC_AUTH_PATHS.some((path) =>
      requestUrl.includes(path),
    );

    if (status === 401 && !isPublicAuth && !handlingUnauthorized) {
      handlingUnauthorized = true;
      clearAuthSession();
      window.location.href = "/signin";
    }

    return Promise.reject(error);
  },
);

export default api;
