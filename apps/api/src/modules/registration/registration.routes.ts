import { Router } from "express";
import { verifyJWT, requireRole } from "../../shared/middleware/auth";
import {
  createRegistrationHandler,
  getMyRegistrationsHandler,
  getMyRegistrationByIdHandler,
  cancelRegistrationHandler,
} from "./registration.controller";

export const registrationRouter = Router();

// Tất cả registration routes đều yêu cầu đăng nhập
registrationRouter.use(verifyJWT);

/**
 * POST /api/v1/registrations
 * Body: { workshopId }
 * Chỉ student mới được đăng ký
 */
registrationRouter.post("/", requireRole("student"), createRegistrationHandler);

/**
 * GET /api/v1/registrations/me
 * Danh sách tất cả đăng ký của student đang login
 * ⚠️ Phải đặt TRƯỚC /:id để tránh Express match "me" thành param
 */
registrationRouter.get(
  "/me",
  requireRole("student"),
  getMyRegistrationsHandler,
);

/**
 * GET /api/v1/registrations/me/:id
 * Chi tiết một đăng ký + QR code
 */
registrationRouter.get(
  "/me/:id",
  requireRole("student"),
  getMyRegistrationByIdHandler,
);

/**
 * DELETE /api/v1/registrations/:id
 * Hủy đăng ký (chỉ được hủy trước khi workshop bắt đầu)
 */
registrationRouter.delete(
  "/:id",
  requireRole("student"),
  cancelRegistrationHandler,
);
