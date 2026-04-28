import axios from "axios";
import jwt from "jsonwebtoken";
import { prisma } from "../../shared/database/prisma";
import { redis } from "../../shared/redis/client";
import * as CircuitBreaker from "../../shared/circuit-breaker/circuit-breaker";
import { GatewayResponse, IdempotencyCache } from "./payment.types";
import { enqueueRegistrationNotifications } from "../notification/notification.scheduler";
import { QrPayload } from "../registration/registration.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const GATEWAY_URL = process.env.MOCK_GATEWAY_URL ?? "http://localhost:3001";
const GATEWAY_TIMEOUT_MS = parseInt(
  process.env.PAYMENT_GATEWAY_TIMEOUT_MS ?? "10000",
);
const IDEMPOTENCY_TTL_SEC = 86400; // 24 giờ
const CB_NAME = "payment_gateway";
const JWT_SECRET = process.env.JWT_SECRET!;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const appError = (message: string, status: number, extra?: object) =>
  Object.assign(new Error(message), { status, ...extra });

const idempotencyKey = (key: string) => `idempotency:${key}`;

const generateQrCode = (
  registrationId: string,
  workshopId: string,
  userId: string,
  workshopStartsAt: Date,
): string => {
  const exp = Math.floor(workshopStartsAt.getTime() / 1000) + 2 * 60 * 60;
  const payload: QrPayload & { exp: number } = {
    sub: registrationId,
    workshopId,
    userId,
    type: "workshop_qr",
    exp,
  };
  return jwt.sign(payload, JWT_SECRET);
};

// ─── Idempotency helpers ──────────────────────────────────────────────────────

const getIdempotencyCache = async (
  key: string,
): Promise<IdempotencyCache | null> => {
  const raw = await redis.get(idempotencyKey(key));
  return raw ? (JSON.parse(raw) as IdempotencyCache) : null;
};

const setIdempotencyCache = async (
  key: string,
  data: IdempotencyCache,
): Promise<void> => {
  await redis.set(
    idempotencyKey(key),
    JSON.stringify(data),
    "EX",
    IDEMPOTENCY_TTL_SEC,
  );
};

const delIdempotencyCache = async (key: string): Promise<void> => {
  await redis.del(idempotencyKey(key));
};

// ─── Service: POST /payments/:registrationId ─────────────────────────────────

export const processPayment = async (
  registrationId: string,
  userId: string,
  clientIdempotencyKey: string, // từ header Idempotency-Key
) => {
  // ── 1. Validate registration ──────────────────────────────────────────────
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, userId },
    include: {
      workshop: {
        select: {
          id: true,
          title: true,
          price: true,
          startsAt: true,
          endsAt: true,
          status: true,
          room: { select: { name: true, building: true } },
        },
      },
      payment: true,
    },
  });

  if (!registration) {
    throw appError("Không tìm thấy đăng ký.", 404);
  }

  if (registration.status === "confirmed") {
    throw appError("Đăng ký này đã được xác nhận rồi.", 400);
  }

  if (registration.status === "cancelled") {
    throw appError("Đăng ký này đã bị hủy.", 400);
  }

  if (registration.workshop.status === "cancelled") {
    throw appError("Workshop này đã bị hủy.", 400);
  }

  const amount = Number(registration.workshop.price);
  if (amount <= 0) {
    throw appError("Workshop này miễn phí, không cần thanh toán.", 400);
  }

  // ── 2. Idempotency check ──────────────────────────────────────────────────
  const cached = await getIdempotencyCache(clientIdempotencyKey);

  if (cached) {
    if (cached.status === "PROCESSING") {
      // Request trước đang xử lý — không gọi gateway lần nữa
      throw appError("Thanh toán đang được xử lý. Vui lòng đợi.", 409, {
        code: "PAYMENT_PROCESSING",
      });
    }

    if (cached.status === "COMPLETED" && cached.result) {
      // Đã thành công trước đó → trả về kết quả cache, KHÔNG charge lại
      console.log(
        `[Payment] Idempotency HIT (COMPLETED) key=${clientIdempotencyKey}`,
      );
      const reg = await prisma.registration.findUnique({
        where: { id: registrationId },
        select: { id: true, status: true, qrCode: true },
      });
      return {
        idempotent: true,
        registration: reg,
        payment: registration.payment,
      };
    }

    if (cached.status === "FAILED") {
      // Lần trước thất bại → xóa cache, cho phép retry
      await delIdempotencyCache(clientIdempotencyKey);
    }
  }

  // ── 3. Đánh dấu PROCESSING trước khi gọi gateway ─────────────────────────
  await setIdempotencyCache(clientIdempotencyKey, { status: "PROCESSING" });

  // ── 4. Gọi gateway qua Circuit Breaker ───────────────────────────────────
  let gatewayResult: GatewayResponse;

  try {
    gatewayResult = await CircuitBreaker.execute(CB_NAME, async () => {
      const response = await axios.post<GatewayResponse>(
        `${GATEWAY_URL}/charge`,
        {
          amount,
          idempotencyKey: clientIdempotencyKey,
          description: `Workshop: ${registration.workshop.title}`,
        },
        { timeout: GATEWAY_TIMEOUT_MS },
      );
      return response.data;
    });
  } catch (err: any) {
    // Circuit OPEN → fast fail
    if (err.code === "CIRCUIT_OPEN") {
      await delIdempotencyCache(clientIdempotencyKey);
      throw appError(
        "Dịch vụ thanh toán tạm thời không khả dụng. Các tính năng khác vẫn hoạt động bình thường.",
        503,
        { code: "PAYMENT_GATEWAY_UNAVAILABLE", retryAfter: err.retryAfter },
      );
    }

    // Timeout
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      await delIdempotencyCache(clientIdempotencyKey);
      throw appError(
        "Thanh toán chưa được xác nhận do timeout. Vui lòng thử lại.",
        504,
        { code: "PAYMENT_TIMEOUT" },
      );
    }

    // Gateway error (4xx/5xx)
    await setIdempotencyCache(clientIdempotencyKey, {
      status: "FAILED",
      errorMessage: err.response?.data?.error ?? err.message,
    });
    throw appError("Thanh toán thất bại. Vui lòng thử lại.", 502, {
      code: "PAYMENT_FAILED",
    });
  }

  // ── 5. Lưu kết quả thành công vào idempotency cache ──────────────────────
  await setIdempotencyCache(clientIdempotencyKey, {
    status: "COMPLETED",
    result: gatewayResult,
  });

  // ── 6. DB Transaction: cập nhật payment + registration + sinh QR ─────────
  const qrCode = generateQrCode(
    registrationId,
    registration.workshop.id,
    userId,
    registration.workshop.startsAt,
  );

  const [updatedPayment, updatedReg] = await prisma.$transaction([
    // Upsert payment record
    prisma.payment.upsert({
      where: { idempotencyKey: clientIdempotencyKey },
      create: {
        idempotencyKey: clientIdempotencyKey,
        amount,
        status: "completed",
        gatewayRef: gatewayResult.gatewayRef,
      },
      update: {
        status: "completed",
        gatewayRef: gatewayResult.gatewayRef,
      },
    }),
    // Confirm registration + gắn QR
    prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: "confirmed",
        qrCode,
      },
      select: {
        id: true,
        status: true,
        qrCode: true,
        workshop: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            room: { select: { name: true, building: true } },
          },
        },
      },
    }),
  ]);

  // Link payment với registration nếu chưa có
  if (!registration.paymentId) {
    await prisma.registration.update({
      where: { id: registrationId },
      data: { payment: { connect: { id: updatedPayment.id } } },
    });
  }

  await enqueueRegistrationNotifications(
    {
      registrationId,
      userId,
      workshop: registration.workshop,
    },
    { includeRegistrationSuccess: true },
  );

  return {
    idempotent: false,
    registration: updatedReg,
    payment: {
      id: updatedPayment.id,
      amount: updatedPayment.amount,
      status: updatedPayment.status,
      gatewayRef: updatedPayment.gatewayRef,
    },
  };
};

// ─── Service: GET /payments/:registrationId ───────────────────────────────────

export const getPaymentStatus = async (
  registrationId: string,
  userId: string,
) => {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, userId },
    select: {
      id: true,
      status: true,
      qrCode: true,
      payment: {
        select: {
          id: true,
          amount: true,
          status: true,
          gatewayRef: true,
          createdAt: true,
        },
      },
    },
  });

  if (!registration) throw appError("Không tìm thấy đăng ký.", 404);

  return { registration };
};

// ─── Service: GET /admin/circuit-breaker ─────────────────────────────────────

export const getCircuitBreakerStatus = async () => {
  const state = await CircuitBreaker.getCircuitState(CB_NAME);
  return { circuitBreaker: { name: CB_NAME, ...state } };
};

export const resetCircuitBreaker = async () => {
  await CircuitBreaker.resetCircuit(CB_NAME);
  return { message: `Circuit breaker '${CB_NAME}' đã được reset về CLOSED.` };
};
