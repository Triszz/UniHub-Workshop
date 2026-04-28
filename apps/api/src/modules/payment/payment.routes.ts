import { Router } from "express";
import { verifyJWT, requireRole } from "../../shared/middleware/auth";
import {
  processPaymentHandler,
  getPaymentStatusHandler,
  getCircuitBreakerHandler,
  resetCircuitBreakerHandler,
} from "./payment.controller";

export const paymentRouter = Router();

// Tất cả đều yêu cầu xác thực
paymentRouter.use(verifyJWT);

/**
 * POST /api/v1/payments/:registrationId
 * Header bắt buộc: Idempotency-Key: <uuid-v4>
 * Chỉ student của registration đó mới được thanh toán
 */
paymentRouter.post(
  "/:registrationId",
  requireRole("student"),
  processPaymentHandler,
);

/**
 * GET /api/v1/payments/:registrationId/status
 * Kiểm tra trạng thái thanh toán (dùng để polling từ frontend)
 */
paymentRouter.get(
  "/:registrationId/status",
  requireRole("student"),
  getPaymentStatusHandler,
);

/**
 * GET /api/v1/admin/circuit-breaker
 * Xem trạng thái circuit breaker hiện tại
 */
export const circuitBreakerAdminRouter = Router();
circuitBreakerAdminRouter.use(verifyJWT, requireRole("organizer"));

circuitBreakerAdminRouter.get("/", getCircuitBreakerHandler);
circuitBreakerAdminRouter.post("/reset", resetCircuitBreakerHandler);
