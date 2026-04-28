import { Router } from "express";
import { verifyJWT, requireRole } from "../../shared/middleware/auth";
import {
  listWorkshopsHandler,
  getWorkshopHandler,
  adminListWorkshopsHandler,
  adminGetWorkshopHandler,
  adminListWorkshopRegistrationsHandler,
  createWorkshopHandler,
  updateWorkshopHandler,
  cancelWorkshopHandler,
  getWorkshopStatsHandler,
} from "./workshop.controller";

// ─── Public routes (/api/v1/workshops) ───────────────────────────────────────
export const workshopPublicRouter = Router();

/**
 * GET /api/v1/workshops
 * Query: ?page=1&limit=20&date=2024-07-15
 * Chỉ trả workshop có status = 'published'
 */
workshopPublicRouter.get("/", listWorkshopsHandler);

/**
 * GET /api/v1/workshops/:id
 * Trả 404 nếu không tồn tại hoặc chưa published
 */
workshopPublicRouter.get("/:id", getWorkshopHandler);

// ─── Admin routes (/api/v1/admin/workshops) ───────────────────────────────────
export const workshopAdminRouter = Router();

// Tất cả admin routes đều yêu cầu organizer
workshopAdminRouter.use(verifyJWT, requireRole("organizer"));

/**
 * GET /api/v1/admin/workshops
 * Query: ?page=1&limit=20&status=draft&date=2024-07-15
 * Trả tất cả workshop kể cả draft và cancelled
 */
workshopAdminRouter.get("/", adminListWorkshopsHandler);

/**
 * GET /api/v1/admin/workshops/:id
 */
workshopAdminRouter.get("/:id", adminGetWorkshopHandler);

/**
 * GET /api/v1/admin/workshops/:id/registrations
 * Query: ?status=all|pending|confirmed|checked_in|cancelled&page=1&limit=50
 */
workshopAdminRouter.get(
  "/:id/registrations",
  adminListWorkshopRegistrationsHandler,
);

/**
 * POST /api/v1/admin/workshops
 * Body: CreateWorkshopDto
 */
workshopAdminRouter.post("/", createWorkshopHandler);

/**
 * PATCH /api/v1/admin/workshops/:id
 * Body: UpdateWorkshopDto (tất cả optional)
 */
workshopAdminRouter.patch("/:id", updateWorkshopHandler);

/**
 * DELETE /api/v1/admin/workshops/:id
 * Soft cancel — không xóa khỏi DB
 */
workshopAdminRouter.delete("/:id", cancelWorkshopHandler);

/**
 * GET /api/v1/admin/workshops/:id/stats
 * Thống kê đăng ký, check-in, doanh thu
 */
workshopAdminRouter.get("/:id/stats", getWorkshopStatsHandler);
