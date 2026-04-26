import { api } from "./api";
import type { Workshop, WorkshopListResponse } from "../types";

/**
 * Normalize numeric fields that Prisma Decimal may serialize as strings.
 */
const normalizeWorkshop = (ws: Workshop): Workshop => ({
  ...ws,
  price: Number(ws.price),
  capacity: Number(ws.capacity),
  registeredCount: Number(ws.registeredCount),
});

export interface StudentWorkshopParams {
  page?: number;
  limit?: number;
  date?: string; // YYYY-MM-DD
}

export const studentWorkshopService = {
  /**
   * Get published workshops (student-facing, supports date filter)
   */
  getAll: async (
    params: StudentWorkshopParams = {}
  ): Promise<WorkshopListResponse> => {
    const query: Record<string, string | number> = {};
    if (params.page) query.page = params.page;
    if (params.limit) query.limit = params.limit;
    if (params.date) query.date = params.date;

    const response = await api.get<WorkshopListResponse>("/workshops", {
      params: query,
    });
    return {
      ...response.data,
      workshops: response.data.workshops.map(normalizeWorkshop),
    };
  },

  /**
   * Get a single workshop by ID (student-facing)
   */
  getById: async (id: string): Promise<Workshop> => {
    const response = await api.get<{ workshop: Workshop }>(`/workshops/${id}`);
    return normalizeWorkshop(response.data.workshop);
  },
};
