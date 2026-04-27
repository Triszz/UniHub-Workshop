export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

// Response từ mock gateway
export interface GatewayResponse {
  success: boolean;
  gatewayRef: string;
  amount: number;
  processedAt: string;
}

// Idempotency cache lưu trong Redis
export interface IdempotencyCache {
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  result?: GatewayResponse;
  errorMessage?: string;
}
