import { Request, Response, NextFunction } from "express";
import * as AiSummaryService from "./ai-summary.service";

// ─── POST /admin/workshops/:id/pdf ────────────────────────────────────────────

export const uploadPdfHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Vui lòng chọn file PDF để upload." });
      return;
    }

    const result = await AiSummaryService.uploadPdfAndEnqueue(
      req.params.id as string,
      req.file,
    );

    // 202 Accepted — xử lý bất đồng bộ
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
};

// ─── POST /admin/workshops/:id/ai-summary/retry ───────────────────────────────

export const retryAiSummaryHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await AiSummaryService.retryAiSummary(
      req.params.id as string,
    );
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
};

// ─── GET /admin/workshops/:id/ai-summary/status ───────────────────────────────

export const getAiSummaryStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await AiSummaryService.getAiSummaryStatus(
      req.params.id as string,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
