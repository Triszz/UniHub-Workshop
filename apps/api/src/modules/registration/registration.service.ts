import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { prisma } from "../../shared/database/prisma";
import { QrPayload } from "./registration.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET!;
const PRIVATE_KEY = fs.readFileSync(
  path.join(__dirname, "../../keys/private_key.pem"),
  "utf-8"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const appError = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

/**
 * Sinh QR code: JWT signed với RS256 (RSA) chứa registrationId, workshopId, userId.
 * Hết hạn 2 tiếng sau khi workshop bắt đầu.
 */
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

  return jwt.sign(payload, PRIVATE_KEY, { algorithm: "RS256" });
};

// ─── Service: POST /registrations ────────────────────────────────────────────

export const register = async (userId: string, workshopId: string) => {
  // ── Bước 1: Validate workshop ───────────────────────────────────────────────
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      id: true,
      title: true,
      status: true,
      price: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      registeredCount: true,
      room: { select: { name: true, building: true } },
    },
  });

  if (!workshop || workshop.status !== "published") {
    throw appError("Workshop không tồn tại.", 404);
  }

  if (workshop.endsAt < new Date()) {
    throw appError("Workshop đã kết thúc, không thể đăng ký.", 400);
  }

  const isPaid = Number(workshop.price) > 0;

  // ── Bước 2: Kiểm tra đã đăng ký chưa ──────────────────────────────────────
  const existingReg = await prisma.registration.findUnique({
    where: { userId_workshopId: { userId, workshopId } },
  });

  // ── Duplicate handling ────────────────────────────────────────────────────
  if (existingReg && existingReg.status !== "cancelled") {
    // Paid workshop: pending or confirmed/checked_in → trả checkoutUrl hoặc registration
    if (isPaid) {
      if (existingReg.status === "pending") {
        // Trả checkoutUrl để user tiếp tục checkout
        return {
          registration: existingReg,
          checkoutUrl: `/checkout/${existingReg.id}`,
        };
      }
      // confirmed / checked_in → trả registration hiện có
      return { registration: existingReg };
    }
    // Free workshop: giữ rule 409
    throw appError("Bạn đã đăng ký workshop này rồi.", 409);
  }

  // ── Bước 3: Determine target status ─────────────────────────────────────────
  const targetStatus = isPaid ? "pending" : "confirmed";

  // ── Bước 4: DB Transaction với SELECT FOR UPDATE ──────────────────────────
  //
  // KHÔNG dùng Redis distributed lock vì:
  //   - Lock chỉ cho 1 request qua tại một thời điểm → bottleneck nghiêm trọng
  //   - SELECT FOR UPDATE đã đủ để chống race condition ở tầng DB
  //
  // Cách PostgreSQL xử lý 100 concurrent requests:
  //   - Tất cả vào transaction, nhưng chỉ 1 transaction hold row lock tại một thời điểm
  //   - Các transaction khác WAIT (không bị từ chối) cho đến khi lock được release
  //   - Mỗi transaction sau khi có lock sẽ đọc registeredCount MỚI NHẤT
  //   - Transaction thứ 61 trở đi thấy registeredCount = 60 = capacity → throw 409
  //
  // Kết quả: đúng 60 thành công, 40 nhận 409 "Hết chỗ" — không có double-booking
  //
  const registration = await prisma.$transaction(
    async (tx) => {
      // SELECT FOR UPDATE: lock row workshop, đọc giá trị HIỆN TẠI (không bị stale read)
      const rows = await tx.$queryRaw<
        Array<{ id: string; registered_count: number; capacity: number }>
      >`
        SELECT id, registered_count, capacity
        FROM workshops
        WHERE id = ${workshopId}
        FOR UPDATE
      `;

      if (rows.length === 0) throw appError("Workshop không tồn tại.", 404);

      const { registered_count, capacity } = rows[0];

      // Guard cuối cùng — đọc sau khi có lock nên luôn chính xác
      if (registered_count >= capacity) {
        throw appError("Workshop đã hết chỗ.", 409);
      }

      // Upsert registration
      let reg;
      if (existingReg?.status === "cancelled") {
        reg = await tx.registration.update({
          where: { id: existingReg.id },
          data: { status: targetStatus, qrCode: null },
        });
      } else {
        reg = await tx.registration.create({
          data: { userId, workshopId, status: targetStatus },
        });
      }

      // Seat hold: tăng registeredCount trong cùng transaction — atomic
      // (áp dụng cho cả paid pending và free confirmed)
      await tx.workshop.update({
        where: { id: workshopId },
        data: { registeredCount: { increment: 1 } },
      });

      return reg;
    },
    {
      // Timeout transaction: 10 giây
      // Khi 100 requests xếp hàng chờ lock, request cuối cùng có thể chờ lâu
      timeout: 10_000,
    },
  );

  // ── Bước 5: For free workshop, sinh QR code (ngoài transaction) ───────────────────────────────
  if (!isPaid) {
    const qrCode = generateQrCode(
      registration.id,
      workshopId,
      userId,
      workshop.startsAt,
    );

    const updatedReg = await prisma.registration.update({
      where: { id: registration.id },
      data: { qrCode },
      select: { id: true, status: true, qrCode: true, createdAt: true },
    });

    // ── Enqueue notification (TODO Ngày 9) ─────────────────────────────────
    console.log(
      `[TODO] Enqueue notification: registration_confirmed — user ${userId}, workshop ${workshopId}`,
    );

    return {
      registration: {
        ...updatedReg,
        workshop: {
          id: workshop.id,
          title: workshop.title,
          startsAt: workshop.startsAt,
          endsAt: workshop.endsAt,
          room: workshop.room,
        },
      },
    };
  }

  // ── Bước 6: For paid workshop, return pending registration with checkoutUrl ────────────────
  // Không sinh QR, để thi payment xử lý
  return {
    registration: {
      id: registration.id,
      status: registration.status,
      createdAt: registration.createdAt,
      workshop: {
        id: workshop.id,
        title: workshop.title,
        startsAt: workshop.startsAt,
        endsAt: workshop.endsAt,
        room: workshop.room,
      },
    },
    checkoutUrl: `/checkout/${registration.id}`,
  };
};

// Alias để không break controller nếu muốn giữ nguyên
export const registerFree = register;

// ─── Service: GET /registrations/me ──────────────────────────────────────────

export const getMyRegistrations = async (userId: string) => {
  const registrations = await prisma.registration.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      qrCode: true,
      createdAt: true,
      workshop: {
        select: {
          id: true,
          title: true,
          speakerName: true,
          startsAt: true,
          endsAt: true,
          price: true,
          status: true,
          room: { select: { name: true, building: true } },
        },
      },
      payment: {
        select: { id: true, amount: true, status: true },
      },
    },
  });

  return { registrations };
};

// ─── Service: GET /registrations/me/:id ──────────────────────────────────────

export const getMyRegistrationById = async (
  userId: string,
  registrationId: string,
) => {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, userId },
    select: {
      id: true,
      status: true,
      qrCode: true,
      createdAt: true,
      updatedAt: true,
      workshop: {
        select: {
          id: true,
          title: true,
          description: true,
          speakerName: true,
          startsAt: true,
          endsAt: true,
          price: true,
          status: true,
          room: { select: { name: true, building: true, floorMapUrl: true } },
        },
      },
      payment: {
        select: { id: true, amount: true, status: true, gatewayRef: true },
      },
      checkin: {
        select: { checkedInAt: true, isOffline: true },
      },
    },
  });

  if (!registration) throw appError("Không tìm thấy đăng ký.", 404);

  return { registration };
};

// ─── Service: DELETE /registrations/:id ──────────────────────────────────────

export const cancelRegistration = async (
  userId: string,
  registrationId: string,
) => {
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, userId },
    include: { workshop: true },
  });

  if (!registration) throw appError("Không tìm thấy đăng ký.", 404);
  if (registration.status === "cancelled")
    throw appError("Đăng ký đã được hủy trước đó.", 400);
  if (registration.status === "checked_in")
    throw appError("Không thể hủy sau khi đã check-in.", 400);
  if (registration.workshop.startsAt <= new Date())
    throw appError("Không thể hủy sau khi workshop đã bắt đầu.", 400);

  await prisma.$transaction([
    prisma.registration.update({
      where: { id: registrationId },
      data: { status: "cancelled", qrCode: null },
    }),
    prisma.workshop.update({
      where: { id: registration.workshopId },
      data: { registeredCount: { decrement: 1 } },
    }),
  ]);

  return { cancelled: true, registrationId };
};
