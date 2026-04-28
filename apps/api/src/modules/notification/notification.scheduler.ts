import { prisma } from "../../shared/database/prisma";
import { notificationQueue } from "./notification.queue";

type WorkshopNotificationInfo = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  room?: { name?: string | null; building?: string | null } | null;
};

type RegistrationNotificationInput = {
  registrationId: string;
  userId: string;
  workshop: WorkshopNotificationInfo;
};

type NotificationMilestone =
  | "registration_success"
  | "reminder_1d"
  | "reminder_1h"
  | "reminder_15m"
  | "started"
  | "ended";

const RETRY_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 60000 },
  removeOnComplete: true,
} as const;

const milestoneContent: Record<
  NotificationMilestone,
  (workshopTitle: string) => { title: string; message: string }
> = {
  registration_success: (title) => ({
    title: `Đăng ký workshop ${title} thành công`,
    message: `Bạn đã đăng ký thành công workshop ${title}. QR check-in đã sẵn sàng trong Đăng ký của tôi.`,
  }),
  reminder_1d: (title) => ({
    title: `Workshop ${title} diễn ra sau 1 ngày`,
    message: `Workshop ${title} của bạn sẽ diễn ra sau 1 ngày.`,
  }),
  reminder_1h: (title) => ({
    title: `Workshop ${title} diễn ra sau 1 giờ`,
    message: `Workshop ${title} của bạn sẽ diễn ra sau 1 giờ.`,
  }),
  reminder_15m: (title) => ({
    title: `Workshop ${title} diễn ra sau 15 phút`,
    message: `Workshop ${title} của bạn sẽ diễn ra sau 15 phút.`,
  }),
  started: (title) => ({
    title: `Workshop ${title} đang diễn ra`,
    message: `Workshop ${title} của bạn đã bắt đầu. Hãy mở QR để check-in.`,
  }),
  ended: (title) => ({
    title: `Workshop ${title} đã kết thúc`,
    message: `Workshop ${title} của bạn đã kết thúc. Cảm ơn bạn đã tham gia.`,
  }),
};

const formatStartsAt = (date: Date) =>
  date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const enqueueNotification = async (
  input: RegistrationNotificationInput,
  milestone: NotificationMilestone,
  scheduledAt: Date,
) => {
  const now = Date.now();
  const delay = Math.max(0, scheduledAt.getTime() - now);
  const content = milestoneContent[milestone](input.workshop.title);

  await notificationQueue.add(
    "send-notification",
    {
      type: "registration_lifecycle",
      userId: input.userId,
      payload: {
        title: content.title,
        message: content.message,
        milestone,
        registrationId: input.registrationId,
        workshopId: input.workshop.id,
        workshopTitle: input.workshop.title,
        startsAt: formatStartsAt(input.workshop.startsAt),
        roomName: input.workshop.room?.name ?? null,
      },
    },
    {
      ...RETRY_OPTIONS,
      delay,
      jobId: `registration_lifecycle:${input.registrationId}:${milestone}`,
    },
  );
};

export const enqueueRegistrationNotifications = async (
  input: RegistrationNotificationInput,
  options: { includeRegistrationSuccess?: boolean } = {},
) => {
  const now = Date.now();
  const startsAt = input.workshop.startsAt.getTime();
  const endsAt = input.workshop.endsAt.getTime();

  if (options.includeRegistrationSuccess) {
    await enqueueNotification(input, "registration_success", new Date());
  }

  const reminderMilestones: Array<[NotificationMilestone, number]> = [
    ["reminder_1d", startsAt - 24 * 60 * 60 * 1000],
    ["reminder_1h", startsAt - 60 * 60 * 1000],
    ["reminder_15m", startsAt - 15 * 60 * 1000],
  ];

  for (const [milestone, scheduledAt] of reminderMilestones) {
    if (scheduledAt > now) {
      await enqueueNotification(input, milestone, new Date(scheduledAt));
    }
  }

  if (startsAt > now || (startsAt <= now && endsAt > now)) {
    await enqueueNotification(input, "started", new Date(Math.max(startsAt, now)));
  }

  if (endsAt > now) {
    await enqueueNotification(input, "ended", new Date(endsAt));
  }
};

export const scheduleUpcomingRegistrationNotifications = async () => {
  const registrations = await prisma.registration.findMany({
    where: {
      status: { in: ["confirmed", "checked_in"] },
      workshop: {
        status: "published",
        endsAt: { gt: new Date() },
      },
    },
    select: {
      id: true,
      userId: true,
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
  });

  await Promise.all(
    registrations.map((registration) =>
      enqueueRegistrationNotifications({
        registrationId: registration.id,
        userId: registration.userId,
        workshop: registration.workshop,
      }),
    ),
  );

  return registrations.length;
};
