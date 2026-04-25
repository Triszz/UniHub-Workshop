import { api } from "./api";
import type {
  Workshop,
  WorkshopFormData,
  WorkshopListResponse,
  CancelWorkshopResponse,
  Room,
} from "../types";

// Fallback rooms from seed data (no rooms endpoint exists)
const SEED_ROOMS: Room[] = [
  { id: "room-hall-a", name: "Hoi truong A", building: "Toa A", capacity: 200 },
  { id: "room-b401", name: "B4.01", building: "Toa B", capacity: 80 },
  { id: "room-c201", name: "C2.01", building: "Toa C", capacity: 60 },
];

/**
 * Normalize numeric fields that Prisma Decimal may serialize as strings.
 */
const normalizeWorkshop = (ws: Workshop): Workshop => ({
  ...ws,
  price: Number(ws.price),
  capacity: Number(ws.capacity),
  registeredCount: Number(ws.registeredCount),
});

export const workshopService = {
  /**
   * Get all workshops (admin view — includes draft & cancelled)
   */
  getAll: async (): Promise<WorkshopListResponse> => {
    const response = await api.get<WorkshopListResponse>("/admin/workshops");
    return {
      ...response.data,
      workshops: response.data.workshops.map(normalizeWorkshop),
    };
  },

  /**
   * Get a single workshop by ID (admin view)
   */
  getById: async (id: string): Promise<Workshop> => {
    const response = await api.get<{ workshop: Workshop }>(
      `/admin/workshops/${id}`
    );
    return normalizeWorkshop(response.data.workshop);
  },

  /**
   * Create a new workshop
   */
  create: async (data: WorkshopFormData): Promise<Workshop> => {
    const response = await api.post<{ workshop: Workshop }>(
      "/admin/workshops",
      data
    );
    return normalizeWorkshop(response.data.workshop);
  },

  /**
   * Update an existing workshop (partial update)
   */
  update: async (
    id: string,
    data: Partial<WorkshopFormData>
  ): Promise<Workshop> => {
    const response = await api.patch<{ workshop: Workshop }>(
      `/admin/workshops/${id}`,
      data
    );
    return normalizeWorkshop(response.data.workshop);
  },

  /**
   * Cancel (soft delete) a workshop
   */
  cancel: async (id: string): Promise<CancelWorkshopResponse> => {
    const response = await api.delete<CancelWorkshopResponse>(
      `/admin/workshops/${id}`
    );
    return response.data;
  },

  /**
   * Get available rooms.
   * Merges rooms from existing workshops with fallback seed rooms,
   * since there is no dedicated rooms endpoint.
   */
  getRooms: (workshops: Workshop[]): Room[] => {
    const roomMap = new Map<string, Room>();

    // Start with seed rooms
    SEED_ROOMS.forEach((r) => roomMap.set(r.id, r));

    // Merge rooms from fetched workshops (API rooms may have updated names)
    workshops.forEach((w) => {
      if (w.room?.id) {
        roomMap.set(w.room.id, {
          id: w.room.id,
          name: w.room.name,
          building: w.room.building,
        });
      }
    });

    return Array.from(roomMap.values());
  },
};
