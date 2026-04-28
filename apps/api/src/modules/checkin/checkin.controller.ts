import { Request, Response, NextFunction } from "express";
import * as CheckinService from "./checkin.service";
import { OfflineCheckinRecord } from "./checkin.types";

// ─── POST /checkins (online) ──────────────────────────────────────────────────

export const checkInOnlineHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { qrCode, deviceId } = req.body;

    if (!qrCode) {
      res.status(400).json({ error: "qrCode là bắt buộc." });
      return;
    }

    const result = await CheckinService.checkInOnline(
      qrCode,
      deviceId,
      req.user!.id,
    );

    res.status(201).json(result);
  } catch (err: any) {
    // Với 409 ALREADY_CHECKED_IN — trả thêm thời gian check-in trước đó
    if (err.code === "ALREADY_CHECKED_IN") {
      res.status(409).json({
        error: err.message,
        code: err.code,
        checkedInAt: err.checkedInAt,
      });
      return;
    }
    next(err);
  }
};

// ─── POST /checkins/sync (offline batch) ─────────────────────────────────────

export const syncCheckinsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const records: OfflineCheckinRecord[] = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: "Body phải là mảng records không rỗng." });
      return;
    }

    if (records.length > 50) {
      res.status(400).json({
        error: `Tối đa 50 records mỗi lần sync. Nhận được: ${records.length}.`,
      });
      return;
    }

    // Validate từng record có qrCode
    const invalid = records.filter((r) => !r.qrCode || !r.checkedInAt);
    if (invalid.length > 0) {
      res.status(400).json({
        error: `${invalid.length} record thiếu qrCode hoặc checkedInAt.`,
      });
      return;
    }

    const deviceId = req.headers["x-device-id"] as string | undefined;

    const result = await CheckinService.syncOfflineCheckins(records, deviceId);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ─── GET /admin/workshops/:id/checkins ───────────────────────────────────────

export const getWorkshopCheckinsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await CheckinService.getWorkshopCheckins(
      req.params.id as string,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
