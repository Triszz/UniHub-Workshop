import { Router } from "express";
import { verifyJWT, requireRole } from "../../shared/middleware/auth";
import { PrismaClient } from "@prisma/client";
import { csvImportQueue } from "../../workers/csv-import.worker";

export const csvImportAdminRouter = Router();
const prisma = new PrismaClient();

// Yêu cầu role organizer
csvImportAdminRouter.use(verifyJWT, requireRole("organizer"));

// GET /admin/csv-imports
csvImportAdminRouter.get("/", async (req, res, next) => {
  try {
    const logs = await prisma.csvImportLog.findMany({
      orderBy: { startedAt: "desc" },
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// GET /admin/csv-imports/:id
csvImportAdminRouter.get("/:id", async (req, res, next) => {
  try {
    const log = await prisma.csvImportLog.findUnique({
      where: { id: req.params.id },
    });
    if (!log) {
      return res.status(404).json({ error: "Not Found" });
    }
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// POST /admin/csv-imports/trigger
csvImportAdminRouter.post("/trigger", async (req, res, next) => {
  try {
    await csvImportQueue.add("import-csv-job", {});
    res.json({ message: "Import triggered successfully" });
  } catch (err) {
    next(err);
  }
});
