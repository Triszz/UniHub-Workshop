import { api } from "./api";
import type { NotificationListResponse } from "../types";

export const notificationService = {
  getHistory: async (limit = 50, days = 7): Promise<NotificationListResponse> => {
    const response = await api.get<NotificationListResponse>("/notifications", {
      params: { status: "all", limit, days },
    });
    return response.data;
  },

  getUnread: async (limit = 20): Promise<NotificationListResponse> => {
    const response = await api.get<NotificationListResponse>("/notifications", {
      params: { status: "unread", limit },
    });
    return response.data;
  },

  markRead: async (id: string): Promise<void> => {
    await api.patch(`/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await api.patch("/notifications/read-all");
  },
};
