import { api } from "./api";
import type { LoginResponse } from "../types";

export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/auth/login", { email, password });
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post("/auth/logout").catch(() => {});
  },
};
