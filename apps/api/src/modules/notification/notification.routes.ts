import { Router, Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../shared/database/prisma";
import { verifyJWT } from "../../shared/middleware/auth";
import { notificationQueue } from "../../workers/notification.worker";

export const notificationRouter = Router();

const unreadStatuses = ["pending", "sent"];

notificationRouter.get("/", verifyJWT, async (req: Request, res: Response): Promise<any> => {
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20),
  );
  const days = Math.min(
    30,
    Math.max(1, Number.parseInt(String(req.query.days ?? "7"), 10) || 7),
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const status = String(req.query.status ?? "unread");
  const statusWhere: Prisma.NotificationWhereInput =
    status === "all"
      ? {}
      : status === "read"
        ? { status: "read" }
        : { status: { in: unreadStatuses } };

  const where: Prisma.NotificationWhereInput = {
    userId: req.user!.id,
    channel: "in_app",
    createdAt: { gte: since },
    ...statusWhere,
  };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        channel: true,
        payload: true,
        status: true,
        sentAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: {
        userId: req.user!.id,
        channel: "in_app",
        createdAt: { gte: since },
        status: { in: unreadStatuses },
      },
    }),
  ]);

  return res.json({ notifications, unreadCount });
});

notificationRouter.patch(
  "/read-all",
  verifyJWT,
  async (req: Request, res: Response): Promise<any> => {
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user!.id,
        channel: "in_app",
        status: { in: unreadStatuses },
      },
      data: { status: "read" },
    });

    return res.json({ updated: result.count });
  },
);

notificationRouter.patch(
  "/:id/read",
  verifyJWT,
  async (req: Request, res: Response): Promise<any> => {
    const notificationId = String(req.params.id);
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: req.user!.id,
        channel: "in_app",
      },
      select: { id: true },
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "read" },
    });

    return res.json({ id: notification.id, read: true });
  },
);

notificationRouter.post("/test", async (req: Request, res: Response): Promise<any> => {
  const { userId, type, payload } = req.body;

  if (!userId || !type) {
    return res.status(400).json({ error: "Missing userId or type" });
  }

  try {
    await notificationQueue.add(
      "send-notification",
      { type, userId, payload: payload || {} },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 60000 },
        removeOnComplete: true,
      },
    );

    return res.status(200).json({
      message: "Notification job enqueued successfully",
      data: { userId, type },
    });
  } catch (error: any) {
    console.error("Error enqueuing notification:", error);
    return res.status(500).json({ error: error.message });
  }
});
