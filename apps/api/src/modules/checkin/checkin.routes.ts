import { Router } from "express";
import { verifyJWT, requireRole } from "../../shared/middleware/auth";
import {
  checkInOnlineHandler,
  syncCheckinsHandler,
  getWorkshopCheckinsHandler,
  getWorkshopCheckinStatsHandler,
} from "./checkin.controller";

export const checkinRouter = Router();

checkinRouter.use(verifyJWT);

/**
 * POST /api/v1/checkins
 * Online check-in: verify QR, insert record
 * Body: { qrCode: string, deviceId?: string }
 */
checkinRouter.post("/", requireRole("checkin_staff"), checkInOnlineHandler);

/**
 * POST /api/v1/checkins/sync
 * Batch sync offline check-ins từ mobile
 * Body: OfflineCheckinRecord[]  (tối đa 50 records)
 * Header: X-Device-Id (optional)
 *
 * ⚠️ /sync phải đặt TRƯỚC / vì Express match theo thứ tự
 */
checkinRouter.post("/sync", requireRole("checkin_staff"), syncCheckinsHandler);

// ─── Admin routes (mount trong workshopAdminRouter) ───────────────────────────

export const checkinAdminRouter = Router();
checkinAdminRouter.use(verifyJWT, requireRole("organizer"));

/**
 * GET /api/v1/admin/workshops/:id/checkins
 * Danh sách tất cả check-in của một workshop
 */
checkinAdminRouter.get("/", getWorkshopCheckinsHandler);

/**
 * Router riêng cho checkin-stats
 * Mount tại: /api/v1/admin/workshops/:id/checkin-stats
 */
export const checkinStatsAdminRouter = Router();
checkinStatsAdminRouter.use(verifyJWT, requireRole("organizer"));
checkinStatsAdminRouter.get("/", getWorkshopCheckinStatsHandler);
