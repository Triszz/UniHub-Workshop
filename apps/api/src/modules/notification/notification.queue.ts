import { Queue } from "bullmq";
import { redis } from "../../shared/redis/client";

export const NOTIFICATION_QUEUE_NAME = "notification-queue";

export const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
  connection: redis,
});
