import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

// ─── Constants ────────────────────────────────────────────────────────────────

export const TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.7:3000/api/v1";

// ─── Axios instance ───────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10_000, // 10 giây — quan trọng cho circuit breaker test
  headers: { "Content-Type": "application/json" },
});

// ─── Request interceptor: đính kèm JWT vào mọi request ───────────────────────

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response interceptor: xử lý token hết hạn ───────────────────────────────

let isRefreshing = false;
// Hàng đợi các request bị block trong lúc đang refresh token
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Chỉ xử lý 401 TOKEN_EXPIRED, không phải mọi 401
    const isTokenExpired =
      error.response?.status === 401 &&
      (error.response?.data as any)?.code === "TOKEN_EXPIRED" &&
      !originalRequest._retry;

    if (!isTokenExpired) {
      return Promise.reject(error);
    }

    // Nếu đang refresh → đưa request vào hàng đợi, tránh gọi refresh nhiều lần
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) throw new Error("No refresh token");

      // Gọi thẳng axios (không qua interceptor) để tránh vòng lặp vô hạn
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const newToken: string = data.access_token;
      await SecureStore.setItemAsync(TOKEN_KEY, newToken);

      processQueue(null, newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Refresh thất bại → xóa token, để màn hình Login tự xử lý
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ─── Helper: lưu token sau khi login ─────────────────────────────────────────

export const saveTokens = async (
  accessToken: string,
  refreshToken: string,
): Promise<void> => {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
};
