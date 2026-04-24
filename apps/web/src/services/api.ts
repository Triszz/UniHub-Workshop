import axios from "axios";
import type { RefreshResponse } from "../types";
import {
  readAccessToken,
  readRefreshToken,
  updateAccessToken,
  clearAuthSession,
} from "./authSession";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = readAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      error.response?.data?.code === "TOKEN_EXPIRED" &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = "Bearer " + token;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = readRefreshToken();
      if (!refreshToken) {
        isRefreshing = false;
        clearAuthSession();
        processQueue(error, null);
        return Promise.reject(error);
      }

      try {
        const response = await axios.post<RefreshResponse>(`${API_BASE}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newAccessToken = response.data.access_token;
        updateAccessToken(newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        
        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthSession();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);
