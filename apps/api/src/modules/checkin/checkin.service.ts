import jwt from "jsonwebtoken";
import { prisma } from "../../shared/database/prisma";
import { QrPayload } from "../registration/registration.types";
import { OfflineCheckinRecord } from "./checkin.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET!;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const appError = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

/**
 * Verify và decode QR JWT.
 * Throw lỗi rõ ràng nếu invalid hoặc expired.
 */
const verifyQrCode = (qrCode: string): QrPayload => {
  try {
    const payload = jwt.verify(qrCode, JWT_SECRET, {
      ignoreExpiration: true,
    }) as QrPayload;

    // Đảm bảo đúng loại token (không phải auth JWT)
    if (payload.type !== "workshop_qr") {
      throw appError("Mã QR không hợp lệ.", 400);
    }

    return payload;
  } catch (err: any) {
    if (err.status) throw err; // re-throw appError

    if (err.name === "TokenExpiredError") {
      throw appError("Mã QR đã hết hạn.", 400);
    }
    throw appError("Mã QR không hợp lệ.", 400);
  }
};

// ─── Service: POST /checkins (online) ────────────────────────────────────────

export const checkInOnline = async (
  qrCode: string,
  deviceId: string | undefined,
  staffId: string,
) => {
  // 1. Verify QR JWT
  const payload = verifyQrCode(qrCode);

  // 2. Lấy registration kèm thông tin sinh viên
  const registration = await prisma.registration.findUnique({
    where: { id: payload.sub },
    include: {
      user: {
        select: { id: true, fullName: true, studentId: true, email: true },
      },
      workshop: {
        select: { id: true, title: true, startsAt: true, endsAt: true },
      },
      checkin: true,
    },
  });

  if (!registration) {
    throw appError("Đăng ký không tồn tại.", 404);
  }

  // 3. Kiểm tra trạng thái registration
  if (registration.status === "cancelled") {
    throw appError("Đăng ký này đã bị hủy.", 400);
  }
  if (
    registration.status !== "confirmed" &&
    registration.status !== "checked_in"
  ) {
    throw appError("Đăng ký chưa được xác nhận.", 400);
  }

  // 4. Kiểm tra đã check-in chưa (server-side dedup)
  if (registration.checkin) {
    throw Object.assign(new Error("Sinh viên đã check-in rồi."), {
      status: 409,
      code: "ALREADY_CHECKED_IN",
      checkedInAt: registration.checkin.checkedInAt,
    });
  }

  // 5. INSERT checkin + UPDATE registration status
  const now = new Date();

  await prisma.$transaction([
    prisma.checkin.create({
      data: {
        registrationId: registration.id,
        checkedInAt: now,
        syncedAt: now, // online → đã sync ngay
        deviceId: deviceId ?? null,
        isOffline: false,
      },
    }),
    prisma.registration.update({
      where: { id: registration.id },
      data: { status: "checked_in" },
    }),
  ]);

  return {
    success: true,
    student: {
      fullName: registration.user.fullName,
      studentId: registration.user.studentId,
      email: registration.user.email,
    },
    workshop: {
      title: registration.workshop.title,
      startsAt: registration.workshop.startsAt,
    },
    checkedInAt: now,
  };
};

// ─── Service: POST /checkins/sync (offline batch) ────────────────────────────

export const syncOfflineCheckins = async (
  records: OfflineCheckinRecord[],
  deviceId: string | undefined,
) => {
  const synced: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ qrCode: string; reason: string }> = [];

  for (const record of records) {
    try {
      // 1. Verify QR JWT
      const payload = verifyQrCode(record.qrCode);

      // 2. Lấy registration
      const registration = await prisma.registration.findUnique({
        where: { id: payload.sub },
        include: { checkin: true },
      });

      if (!registration) {
        failed.push({
          qrCode: record.qrCode,
          reason: "Đăng ký không tồn tại.",
        });
        continue;
      }

      if (registration.status === "cancelled") {
        failed.push({ qrCode: record.qrCode, reason: "Đăng ký đã bị hủy." });
        continue;
      }

      // 3. Idempotent upsert — nếu đã có checkin → skip (không phải lỗi)
      if (registration.checkin) {
        skipped.push(record.qrCode);
        continue;
      }

      // 4. INSERT checkin
      const checkedInAt = new Date(record.checkedInAt);
      const now = new Date();

      await prisma.$transaction([
        prisma.checkin.create({
          data: {
            registrationId: registration.id,
            checkedInAt: isNaN(checkedInAt.getTime()) ? now : checkedInAt,
            syncedAt: now,
            deviceId: record.deviceId ?? deviceId ?? null,
            isOffline: true,
          },
        }),
        prisma.registration.update({
          where: { id: registration.id },
          data: { status: "checked_in" },
        }),
      ]);

      synced.push(record.qrCode);
    } catch (err: any) {
      // Lỗi không mong đợi cho record này — tiếp tục xử lý record tiếp theo
      failed.push({
        qrCode: record.qrCode,
        reason: err.message ?? "Lỗi không xác định.",
      });
    }
  }

  return {
    synced,
    skipped,
    failed,
    summary: {
      total: records.length,
      synced: synced.length,
      skipped: skipped.length,
      failed: failed.length,
    },
  };
};

// ─── Service: GET /admin/workshops/:id/checkins ───────────────────────────────

export const getWorkshopCheckins = async (workshopId: string) => {
  const checkins = await prisma.checkin.findMany({
    where: {
      registration: { workshopId },
    },
    include: {
      registration: {
        select: {
          id: true,
          user: { select: { fullName: true, studentId: true, email: true } },
        },
      },
    },
    orderBy: { checkedInAt: "asc" },
  });

  return {
    workshopId,
    total: checkins.length,
    checkins: checkins.map((c) => ({
      id: c.id,
      checkedInAt: c.checkedInAt,
      isOffline: c.isOffline,
      syncedAt: c.syncedAt,
      deviceId: c.deviceId,
      registrationId: c.registrationId,
      student: c.registration.user,
    })),
  };
};
