// BullMQ queue instances — import từ đây thay vì tạo mới mỗi module

import { Queue } from "bullmq";
import { redis } from "../redis/client";

// Connection config cho BullMQ
// maxRetriesPerRequest: null là bắt buộc cho BullMQ
const connection = redis;

// ─── Queue instances ──────────────────────────────────────────────────────────

export const aiSummaryQueue = new Queue("ai-summary", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 60_000, // 1 phút, 5 phút, 25 phút
    },
    removeOnComplete: 100, // giữ 100 job completed gần nhất
    removeOnFail: 50,
  },
});

export const notificationQueue = new Queue("notification", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 60_000,
    },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
});

// Log khi queue ready
aiSummaryQueue.on("error", (err) => {
  console.error("[AiSummaryQueue] Error:", err.message);
});

notificationQueue.on("error", (err) => {
  console.error("[NotificationQueue] Error:", err.message);
});
