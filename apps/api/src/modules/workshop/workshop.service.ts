import { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import {
  CreateWorkshopDto,
  RegistrationStatus,
  UpdateWorkshopDto,
  WorkshopRegistrationListQuery,
  WorkshopListQuery,
} from "./workshop.types";
import { notificationQueue } from "../notification/notification.queue";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tạo AppError với status code — errorHandler middleware sẽ đọc err.status
 */
const appError = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

// Select cố định cho public response — không lộ các field nội bộ
const publicWorkshopSelect = {
  id: true,
  title: true,
  description: true,
  speakerName: true,
  speakerBio: true,
  capacity: true,
  registeredCount: true,
  startsAt: true,
  endsAt: true,
  price: true,
  status: true,
  aiSummary: true,
  pdfUrl: true,
  createdAt: true,
  room: {
    select: {
      id: true,
      name: true,
      building: true,
      capacity: true,
      floorMapUrl: true,
    },
  },
} satisfies Prisma.WorkshopSelect;

// Admin response thêm createdBy
const adminWorkshopSelect = {
  ...publicWorkshopSelect,
  createdBy: true,
  isReminderSent: true,
  updatedAt: true,
} satisfies Prisma.WorkshopSelect;

// ─── Public: GET /workshops ───────────────────────────────────────────────────

export const listPublishedWorkshops = async (query: WorkshopListQuery) => {
  const page = Math.max(1, parseInt(query.page ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? "20")));
  const skip = (page - 1) * limit;

  const where: Prisma.WorkshopWhereInput = {
    status: "published",
  };

  // Lọc theo ngày nếu có — lấy workshop diễn ra trong ngày đó
  if (query.date) {
    const start = new Date(query.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(query.date);
    end.setHours(23, 59, 59, 999);
    where.startsAt = { gte: start, lte: end };
  }

  const [workshops, total] = await Promise.all([
    prisma.workshop.findMany({
      where,
      select: publicWorkshopSelect,
      orderBy: { startsAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.workshop.count({ where }),
  ]);

  return {
    workshops,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ─── Public: GET /workshops/:id ───────────────────────────────────────────────

export const getPublishedWorkshopById = async (id: string) => {
  const workshop = await prisma.workshop.findFirst({
    where: { id, status: "published" },
    select: publicWorkshopSelect,
  });

  if (!workshop) {
    // Trả 404 dù workshop tồn tại nhưng chưa publish — tránh info leak
    throw appError("Workshop không tồn tại.", 404);
  }

  return workshop;
};

// ─── Admin: GET /admin/workshops ─────────────────────────────────────────────

export const listAllWorkshops = async (query: WorkshopListQuery) => {
  const page = Math.max(1, parseInt(query.page ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? "20")));
  const skip = (page - 1) * limit;

  const where: Prisma.WorkshopWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.date) {
    const start = new Date(query.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(query.date);
    end.setHours(23, 59, 59, 999);
    where.startsAt = { gte: start, lte: end };
  }

  const [workshops, total] = await Promise.all([
    prisma.workshop.findMany({
      where,
      select: adminWorkshopSelect,
      orderBy: { startsAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.workshop.count({ where }),
  ]);

  return {
    workshops,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Admin: GET /admin/workshops/:id ─────────────────────────────────────────

export const getWorkshopByIdAdmin = async (id: string) => {
  const workshop = await prisma.workshop.findUnique({
    where: { id },
    select: adminWorkshopSelect,
  });

  if (!workshop) {
    throw appError("Workshop không tồn tại.", 404);
  }

  return workshop;
};

export const listWorkshopRegistrations = async (
  id: string,
  query: WorkshopRegistrationListQuery,
) => {
  const workshop = await prisma.workshop.findUnique({
    where: { id },
    select: { id: true, title: true },
  });

  if (!workshop) {
    throw appError("Workshop kh\u00f4ng t\u1ed3n t\u1ea1i.", 404);
  }

  const page = Math.max(1, parseInt(query.page ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "50")));
  const skip = (page - 1) * limit;
  const validStatuses = new Set<RegistrationStatus>([
    "pending",
    "confirmed",
    "checked_in",
    "cancelled",
  ]);

  const status =
    query.status && query.status !== "all" && validStatuses.has(query.status)
      ? query.status
      : undefined;
  const where: Prisma.RegistrationWhereInput = {
    workshopId: id,
    ...(status ? { status } : {}),
  };

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
          },
        },
        checkin: {
          select: {
            checkedInAt: true,
            isOffline: true,
            deviceId: true,
          },
        },
      },
    }),
    prisma.registration.count({ where }),
  ]);

  return {
    workshop,
    registrations: registrations.map((registration) => ({
      ...registration,
      payment: registration.payment
        ? {
            ...registration.payment,
            amount: Number(registration.payment.amount),
          }
        : null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// ─── Admin: POST /admin/workshops ────────────────────────────────────────────

export const createWorkshop = async (
  dto: CreateWorkshopDto,
  createdBy: string,
) => {
  // 1. Validate room tồn tại
  const room = await prisma.room.findUnique({ where: { id: dto.roomId } });
  if (!room) {
    throw appError("Phòng không tồn tại.", 400);
  }

  // 2. Validate thời gian
  const startsAt = new Date(dto.startsAt);
  const endsAt = new Date(dto.endsAt);
  const minStart = new Date(Date.now() + 60 * 60 * 1000); // NOW + 1h

  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    throw appError("Thời gian không hợp lệ.", 400);
  }
  if (startsAt < minStart) {
    throw appError(
      "Thời gian bắt đầu phải ít nhất 1 giờ trong tương lai.",
      400,
    );
  }
  if (endsAt <= startsAt) {
    throw appError("Thời gian kết thúc phải sau thời gian bắt đầu.", 400);
  }

  // 3. Validate capacity
  if (dto.capacity < 1 || dto.capacity > 500) {
    throw appError("Sức chứa phải từ 1 đến 500.", 400);
  }

  // 4. Validate price
  if (dto.price < 0) {
    throw appError("Giá không thể âm.", 400);
  }

  const workshop = await prisma.workshop.create({
    data: {
      title: dto.title.trim(),
      description: dto.description?.trim(),
      speakerName: dto.speakerName?.trim(),
      speakerBio: dto.speakerBio?.trim(),
      roomId: dto.roomId,
      capacity: dto.capacity,
      startsAt,
      endsAt,
      price: dto.price,
      status: dto.status ?? "draft",
      createdBy,
    },
    select: adminWorkshopSelect,
  });

  return workshop;
};

// ─── Admin: PATCH /admin/workshops/:id ───────────────────────────────────────

export const updateWorkshop = async (id: string, dto: UpdateWorkshopDto) => {
  // 1. Kiểm tra workshop tồn tại
  const existing = await prisma.workshop.findUnique({ where: { id } });
  if (!existing) {
    throw appError("Workshop không tồn tại.", 404);
  }

  // 2. Không sửa workshop đã hủy
  if (existing.status === "cancelled") {
    throw appError("Không thể sửa workshop đã bị hủy.", 400);
  }

  // 3. Validate room nếu có đổi
  if (dto.roomId && dto.roomId !== existing.roomId) {
    const room = await prisma.room.findUnique({ where: { id: dto.roomId } });
    if (!room) throw appError("Phòng không tồn tại.", 400);
  }

  // 4. Validate capacity nếu có giảm
  if (dto.capacity !== undefined) {
    if (dto.capacity < 1 || dto.capacity > 500) {
      throw appError("Sức chứa phải từ 1 đến 500.", 400);
    }
    if (dto.capacity < existing.registeredCount) {
      throw appError(
        `Không thể giảm sức chứa xuống dưới số đã đăng ký (${existing.registeredCount} người).`,
        400,
      );
    }
  }

  // 5. Validate thời gian nếu có đổi
  const startsAt = dto.startsAt ? new Date(dto.startsAt) : undefined;
  const endsAt = dto.endsAt ? new Date(dto.endsAt) : undefined;

  if (startsAt && isNaN(startsAt.getTime())) {
    throw appError("Thời gian bắt đầu không hợp lệ.", 400);
  }
  if (endsAt && isNaN(endsAt.getTime())) {
    throw appError("Thời gian kết thúc không hợp lệ.", 400);
  }

  // So sánh với giá trị hiện tại nếu chỉ đổi một bên
  const finalStart = startsAt ?? existing.startsAt;
  const finalEnd = endsAt ?? existing.endsAt;
  if (finalEnd <= finalStart) {
    throw appError("Thời gian kết thúc phải sau thời gian bắt đầu.", 400);
  }

  // 6. Validate price
  if (dto.price !== undefined && dto.price < 0) {
    throw appError("Giá không thể âm.", 400);
  }

  // 7. Build update payload — chỉ update các field được gửi lên
  const updateData: Prisma.WorkshopUpdateInput = {};
  if (dto.title !== undefined) updateData.title = dto.title.trim();
  if (dto.description !== undefined)
    updateData.description = dto.description.trim();
  if (dto.speakerName !== undefined)
    updateData.speakerName = dto.speakerName.trim();
  if (dto.speakerBio !== undefined)
    updateData.speakerBio = dto.speakerBio.trim();
  if (dto.roomId !== undefined)
    updateData.room = { connect: { id: dto.roomId } };
  if (dto.capacity !== undefined) updateData.capacity = dto.capacity;
  if (dto.price !== undefined) updateData.price = dto.price;
  if (dto.status !== undefined) updateData.status = dto.status;
  if (startsAt !== undefined) updateData.startsAt = startsAt;
  if (endsAt !== undefined) updateData.endsAt = endsAt;

  // Nếu thời gian thay đổi, reset isReminderSent để Cron job quét lại
  const timeChanged =
    (dto.startsAt || dto.endsAt) &&
    (startsAt?.getTime() !== existing.startsAt.getTime() ||
      endsAt?.getTime() !== existing.endsAt.getTime());

  if (timeChanged) {
    updateData.isReminderSent = false;
  }

  const updated = await prisma.workshop.update({
    where: { id },
    data: updateData,
    select: adminWorkshopSelect,
  });

  // Gửi Notification nếu đổi phòng/giờ và đã published
  const roomChanged = dto.roomId && dto.roomId !== existing.roomId?.toString();

  if (existing.status === "published" && (roomChanged || timeChanged)) {
    const registrations = await prisma.registration.findMany({
      where: { workshopId: id, status: "confirmed" },
      select: { userId: true },
    });

    if (registrations.length > 0) {
      const jobs = registrations.map((reg) => ({
        name: "send-notification",
        data: {
          type: "workshop_updated",
          userId: reg.userId,
          payload: {
            workshopTitle: updated.title,
            startsAt: updated.startsAt.toLocaleString("vi-VN"),
            roomName: updated.room?.name || "Đang cập nhật",
          },
        },
        opts: { attempts: 3, backoff: { type: "exponential", delay: 60000 }, removeOnComplete: true },
      }));
      await notificationQueue.addBulk(jobs);
    }
  }

  return updated;
};

// ─── Admin: DELETE /admin/workshops/:id ──────────────────────────────────────

export const cancelWorkshop = async (id: string) => {
  const existing = await prisma.workshop.findUnique({ where: { id } });

  if (!existing) {
    throw appError("Workshop không tồn tại.", 404);
  }
  if (existing.status === "cancelled") {
    throw appError("Workshop đã bị hủy trước đó.", 400);
  }

  // Không hủy workshop đang diễn ra
  const now = new Date();
  if (existing.startsAt <= now && now <= existing.endsAt) {
    throw appError("Không thể hủy workshop đang diễn ra.", 400);
  }

  // Transaction: hủy workshop + hủy tất cả registrations liên quan
  const result = await prisma.$transaction(async (tx) => {
    // Đếm registrations sẽ bị ảnh hưởng
    const affectedCount = await tx.registration.count({
      where: {
        workshopId: id,
        status: { in: ["pending", "confirmed"] },
      },
    });

    // Hủy tất cả registrations
    await tx.registration.updateMany({
      where: {
        workshopId: id,
        status: { in: ["pending", "confirmed"] },
      },
      data: { status: "cancelled" },
    });

    // Hủy workshop
    const cancelled = await tx.workshop.update({
      where: { id },
      data: { status: "cancelled" },
      select: { id: true, title: true, status: true },
    });

    return { workshop: cancelled, affectedRegistrations: affectedCount };
  });

  // Bắn Notification cho các user bị hủy (những người có registration pending hoặc confirmed)
  if (result.affectedRegistrations > 0) {
    const registrations = await prisma.registration.findMany({
      where: { workshopId: id, status: "cancelled" }, // Vì đã updateMany ở trên nên lấy cancelled
      select: { userId: true },
    });

    const jobs = registrations.map((reg) => ({
      name: "send-notification",
      data: {
        type: "workshop_cancelled",
        userId: reg.userId,
        payload: {
          workshopTitle: existing.title,
        },
      },
      opts: { attempts: 3, backoff: { type: "exponential", delay: 60000 }, removeOnComplete: true },
    }));

    await notificationQueue.addBulk(jobs);
  }

  return result;
};

// ─── Admin: GET /admin/workshops/:id/stats ────────────────────────────────────

export const getWorkshopStats = async (id: string) => {
  const workshop = await prisma.workshop.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      capacity: true,
      status: true,
      price: true,
    },
  });

  if (!workshop) throw appError("Workshop không tồn tại.", 404);

  const [regStats, checkinCount] = await Promise.all([
    prisma.registration.groupBy({
      by: ["status"],
      where: { workshopId: id },
      _count: { status: true },
    }),
    prisma.checkin.count({
      where: { registration: { workshopId: id } },
    }),
  ]);

  // Map groupBy result thành object dễ đọc
  const regByStatus = regStats.reduce(
    (acc, r) => ({ ...acc, [r.status]: r._count.status }),
    {} as Record<string, number>,
  );

  const confirmed = regByStatus["confirmed"] ?? 0;
  const checkedIn = regByStatus["checked_in"] ?? 0;
  const attendanceBase = confirmed + checkedIn;
  const attendanceRate =
    attendanceBase > 0 ? Number(((checkinCount / attendanceBase) * 100).toFixed(1)) : 0;

  // Tính doanh thu (chỉ từ payment completed)
  const revenueResult = await prisma.payment.aggregate({
    where: {
      registration: { workshopId: id },
      status: "completed",
    },
    _sum: { amount: true },
  });

  return {
    workshop,
    registrations: {
      total: Object.values(regByStatus).reduce((a, b) => a + b, 0),
      confirmed,
      pending: regByStatus["pending"] ?? 0,
      cancelled: regByStatus["cancelled"] ?? 0,
      checkedIn,
    },
    checkins: {
      total: checkinCount,
      rate: `${attendanceRate.toFixed(1)}%`,
      attendanceRate,
    },
    revenue: {
      total: Number(revenueResult._sum.amount ?? 0),
      currency: "VND",
    },
  };
};
