import { Request, Response, NextFunction } from "express";
import * as PaymentService from "./payment.service";

// ─── POST /payments/:registrationId ──────────────────────────────────────────

export const processPaymentHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Idempotency-Key phải có trong header
    const idempotencyKey = req.headers["idempotency-key"] as string;

    if (!idempotencyKey) {
      res.status(400).json({
        error: "Header 'Idempotency-Key' là bắt buộc.",
        hint: "Sinh UUID v4 phía client và gửi kèm mỗi request thanh toán.",
      });
      return;
    }

    // Validate format cơ bản (UUID v4)
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidV4Regex.test(idempotencyKey)) {
      res.status(400).json({
        error: "Idempotency-Key phải có định dạng UUID v4.",
      });
      return;
    }

    const result = await PaymentService.processPayment(
      req.params.registrationId as string,
      req.user!.id,
      idempotencyKey,
    );

    // 200 nếu là idempotent hit (đã charge trước đó), 201 nếu mới
    const statusCode = result.idempotent ? 200 : 201;
    res.status(statusCode).json(result);
  } catch (err: any) {
    // Với 503 (circuit open) — thêm Retry-After header
    if (err.status === 503 && err.retryAfter) {
      res.set("Retry-After", String(err.retryAfter));
    }
    next(err);
  }
};

// ─── GET /payments/:registrationId/status ────────────────────────────────────

export const getPaymentStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await PaymentService.getPaymentStatus(
      req.params.registrationId as string,
      req.user!.id,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ─── GET /admin/circuit-breaker ──────────────────────────────────────────────

export const getCircuitBreakerHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await PaymentService.getCircuitBreakerStatus();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ─── POST /admin/circuit-breaker/reset ───────────────────────────────────────

export const resetCircuitBreakerHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await PaymentService.resetCircuitBreaker();
    res.json(result);
  } catch (err) {
    next(err);
  }
};
