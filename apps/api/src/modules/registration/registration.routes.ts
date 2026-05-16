import { Router } from "express";
import { verifyJWT, requireRole } from "../../shared/middleware/auth";
import { tokenBucketLimit } from "../../shared/middleware/rate-limit";
import {
  createRegistrationHandler,
  getMyRegistrationsHandler,
  getMyRegistrationByIdHandler,
  cancelRegistrationHandler,
} from "./registration.controller";

export const registrationRouter = Router();

registrationRouter.use(verifyJWT);

/**
 * POST /api/v1/registrations
 * Áp dụng Token Bucket: 10 tokens, refill 2/giây
 * → 10 request burst OK, request 11+ nhận 429 cho đến khi bucket refill
 */
registrationRouter.post(
  "/",
  requireRole("student"),
  tokenBucketLimit({ capacity: 10, refillRate: 2, keyPrefix: "reg_limit" }),
  createRegistrationHandler,
);

// ⚠️ /me phải đặt TRƯỚC /:id
registrationRouter.get(
  "/me",
  requireRole("student"),
  getMyRegistrationsHandler,
);

registrationRouter.get(
  "/me/:id",
  requireRole("student"),
  getMyRegistrationByIdHandler,
);

registrationRouter.delete(
  "/:id",
  requireRole("student"),
  cancelRegistrationHandler,
);
