import { Router, Request, Response } from "express";
import { notificationQueue } from "../../workers/notification.worker";

export const notificationRouter = Router();

// Test dispatch notification (for manual verification)
notificationRouter.post("/test", async (req: Request, res: Response): Promise<any> => {
  const { userId, type, payload } = req.body;

  if (!userId || !type) {
    return res.status(400).json({ error: "Missing userId or type" });
  }

  try {
    // Đẩy job vào queue với cấu hình retry theo specs (3 lần, backoff: 1min, 5min, 30min)
    // BullMQ hỗ trợ custom backoff strategies, ở đây dùng exponential hoặc fixed array (cần custom logic)
    // Tạm thời dùng exponential backoff
    await notificationQueue.add(
      "send-notification",
      { type, userId, payload: payload || {} },
      { 
        attempts: 3, 
        backoff: { type: "exponential", delay: 60000 },
        removeOnComplete: true
      }
    );

    return res.status(200).json({
      message: "Notification job enqueued successfully",
      data: { userId, type }
    });
  } catch (error: any) {
    console.error("Error enqueuing notification:", error);
    return res.status(500).json({ error: error.message });
  }
});
