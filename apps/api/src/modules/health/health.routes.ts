import { Router } from "express";
import { prisma } from "../../shared/database/prisma";
import { redis } from "../../shared/redis/client";

export const healthRouter = Router();

healthRouter.get("/health", async (req, res) => {
  try {
    // Kiểm tra Postgres
    await prisma.$queryRaw`SELECT 1`;
    // Kiểm tra Redis
    await redis.ping();

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        postgres: "ok",
        redis: "ok",
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      message: "One or more services unavailable",
    });
  }
});
