import { Worker } from "bullmq";
import { redis } from "../shared/redis/client";
import { prisma } from "../shared/database/prisma";
import { notificationService } from "../modules/notification/notification.service";
import { scheduleUpcomingRegistrationNotifications } from "../modules/notification/notification.scheduler";
import { NOTIFICATION_QUEUE_NAME, notificationQueue } from "../modules/notification/notification.queue";

// Khởi tạo Queue
// Khởi tạo Worker
export const notificationWorker = new Worker(
  NOTIFICATION_QUEUE_NAME,
  async (job) => {
    if (job.data.type === "cron_check_reminders") {
      console.log(`[NotificationCron] Bắt đầu quét các workshop cần gửi reminder...`);
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const workshops = await prisma.workshop.findMany({
        where: {
          status: "published",
          isReminderSent: false,
          startsAt: { lte: in24Hours, gt: now },
        },
        include: { room: true },
      });

      let totalReminders = 0;
      for (const workshop of workshops) {
        const registrations = await prisma.registration.findMany({
          where: { workshopId: workshop.id, status: "confirmed" },
          select: { userId: true },
        });

        if (registrations.length > 0) {
          const jobs = registrations.map((reg) => ({
            name: "send-notification",
            data: {
              type: "workshop_reminder",
              userId: reg.userId,
              payload: {
                workshopTitle: workshop.title,
                startsAt: workshop.startsAt.toLocaleString("vi-VN"),
                roomName: workshop.room?.name || "Đang cập nhật",
              },
            },
            opts: { attempts: 3, backoff: { type: "exponential", delay: 60000 }, removeOnComplete: true },
          }));

          await notificationQueue.addBulk(jobs);
          totalReminders += jobs.length;
        }

        await prisma.workshop.update({
          where: { id: workshop.id },
          data: { isReminderSent: true },
        });
      }
      console.log(`[NotificationCron] Quét hoàn tất. Đã đẩy ${totalReminders} jobs cho ${workshops.length} workshops.`);
      return;
    }

    // Logic xử lý gửi notification (email/in-app) thông thường
    console.log(`[NotificationWorker] Processing job ${job.id} of type ${job.data.type}`);
    const { type, userId, payload } = job.data;

    try {
      await notificationService.dispatch(type, userId, payload);
      console.log(`[NotificationWorker] Successfully processed job ${job.id}`);
    } catch (error: any) {
      console.error(`[NotificationWorker] Failed job ${job.id}:`, error.message);
      throw error; // throw để BullMQ biết và tự động retry
    }
  },
  { 
    connection: redis,
    // Tự động retry theo spec (3 lần, backoff) - Mặc định cấu hình lúc enqueue, nhưng ta có thể định nghĩa chung ở đây nếu muốn
    // Hoặc cấu hình lúc add job: { attempts: 3, backoff: { type: 'exponential', delay: 60000 } }
  }
);

notificationWorker.on("failed", (job, err) => {
  console.error(`[NotificationWorker] Job ${job?.id} failed permanently after all retries: ${err.message}`);
});

export const setupNotificationCron = async () => {
  const scheduledCount = await scheduleUpcomingRegistrationNotifications();
  console.log(`[NotificationScheduler] Scheduled lifecycle notifications for ${scheduledCount} active registrations`);
};
