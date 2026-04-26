import { api } from "./api";
import type {
  Registration,
  RegistrationResponse,
  RegistrationListResponse,
} from "../types";


const normalizeRegistration = (reg: Registration): Registration => {
  if (!reg.workshop) return reg;
  return {
    ...reg,
    workshop: {
      ...reg.workshop,
      price: reg.workshop.price !== undefined ? Number(reg.workshop.price) : undefined,
      capacity: reg.workshop.capacity !== undefined ? Number(reg.workshop.capacity) : undefined,
      registeredCount: reg.workshop.registeredCount !== undefined ? Number(reg.workshop.registeredCount) : undefined,
    }
  };
};

export const registrationService = {
  /**
   * Register for a free workshop
   */
  register: async (workshopId: string): Promise<Registration> => {
    const response = await api.post<RegistrationResponse>("/registrations", {
      workshopId,
    });
    return normalizeRegistration(response.data.registration);
  },

  /**
   * Get all registrations for the current user
   */
  getMyRegistrations: async (): Promise<Registration[]> => {
    const response = await api.get<RegistrationListResponse>(
      "/registrations/me"
    );
    return response.data.registrations.map(normalizeRegistration);
  },

  /**
   * Get a single registration detail (includes QR code)
   */
  getMyRegistrationById: async (id: string): Promise<Registration> => {
    const response = await api.get<RegistrationResponse>(
      `/registrations/me/${id}`
    );
    return normalizeRegistration(response.data.registration);
  },

  /**
   * Cancel a registration
   */
  cancel: async (id: string): Promise<void> => {
    await api.delete(`/registrations/${id}`);
  },
};
