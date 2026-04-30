import { Router } from "express";
import multer from "multer";
import { verifyJWT, requireRole } from "../../shared/middleware/auth";
import {
  uploadPdfHandler,
  retryAiSummaryHandler,
  getAiSummaryStatusHandler,
} from "./ai-summary.controller";

// ─── Multer config — lưu trong memory, validate trước khi ghi disk ────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Chỉ hỗ trợ file PDF."));
    }
  },
});

// Multer error handler
const handleMulterError = (err: any, _req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File quá lớn. Tối đa 10MB." });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  if (err?.message === "Chỉ hỗ trợ file PDF.") {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
};

// ─── Router ───────────────────────────────────────────────────────────────────

export const aiSummaryRouter = Router({ mergeParams: true });

aiSummaryRouter.use(verifyJWT, requireRole("organizer"));

/**
 * POST /api/v1/admin/workshops/:id/pdf
 * Upload PDF và trigger AI summary (bất đồng bộ)
 * Form-data: file (PDF, max 10MB)
 */
aiSummaryRouter.post(
  "/:id/pdf",
  upload.single("file"),
  handleMulterError,
  uploadPdfHandler,
);

/**
 * POST /api/v1/admin/workshops/:id/ai-summary/retry
 * Retry khi AI summary thất bại
 */
aiSummaryRouter.post("/:id/ai-summary/retry", retryAiSummaryHandler);

/**
 * GET /api/v1/admin/workshops/:id/ai-summary/status
 * Polling status — dùng cho frontend
 */
aiSummaryRouter.get("/:id/ai-summary/status", getAiSummaryStatusHandler);
