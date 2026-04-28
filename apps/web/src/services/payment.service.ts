import { api } from "./api";
import { registrationService } from "./registration.service";
import type { Registration } from "../types";

type ProcessPaymentResponse = {
  success: boolean;
  status?: string;
  message?: string;
  registration?: Registration;
  idempotent?: boolean;
};

type PollPaymentStatusResponse = {
  registration: Registration;
};

const IDEMPOTENCY_KEY_PREFIX = "idem_key_";

/**
 * Get or create idempotency key for a registration
 * Stored in sessionStorage to persist across page reloads within same checkout session
 */
const getOrCreateIdempotencyKey = (registrationId: string): string => {
  const key = `${IDEMPOTENCY_KEY_PREFIX}${registrationId}`;
  let idempotencyKey = sessionStorage.getItem(key);
  
  if (!idempotencyKey) {
    // Generate UUID v4
    idempotencyKey = crypto.randomUUID();
    sessionStorage.setItem(key, idempotencyKey);
  }
  
  return idempotencyKey;
};

export const paymentService = {
  /**
   * Process payment for a registration
   * Uses idempotency key to ensure only one charge per session
   */
  processPayment: async (
    registrationId: string
  ): Promise<ProcessPaymentResponse> => {
    const idempotencyKey = getOrCreateIdempotencyKey(registrationId);
    
    const response = await api.post<ProcessPaymentResponse>(
      `/payments/${registrationId}`,
      {},
      {
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      }
    );
    return response.data;
  },

  /**
   * Poll payment status
   */
  pollPaymentStatus: async (
    registrationId: string
  ): Promise<PollPaymentStatusResponse> => {
    const response = await api.get<PollPaymentStatusResponse>(
      `/payments/${registrationId}/status`
    );
    return response.data;
  },

  /**
   * Get registration status for initial load
   * @deprecated Use registrationService.getMyRegistrationById directly
   */
  getRegistrationStatus: async (registrationId: string) => {
    return registrationService.getMyRegistrationById(registrationId);
  },
};
