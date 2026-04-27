import { api } from "./api";
import { registrationService } from "./registration.service";
import type { Registration } from "../types";

type ProcessPaymentOptions = {
  shouldFail?: boolean;
  shouldTimeout?: boolean;
};

type ProcessPaymentResponse = {
  success: boolean;
  status?: string;
  message?: string;
  registration?: Registration;
};

export const paymentService = {
  /**
   * Process payment for a registration
   */
  processPayment: async (
    registrationId: string,
    options?: ProcessPaymentOptions
  ): Promise<ProcessPaymentResponse> => {
    const idempotencyKey = crypto.randomUUID();
    const response = await api.post<ProcessPaymentResponse>(
      `/payments/${registrationId}`,
      { ...options },
      {
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      }
    );
    return response.data;
  },

  /**
   * Get registration status for polling
   */
  getRegistrationStatus: async (registrationId: string) => {
    return registrationService.getMyRegistrationById(registrationId);
  },
};
