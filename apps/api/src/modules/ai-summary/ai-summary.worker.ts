import { Worker, Job } from "bullmq";
import fs from "fs";
import path from "path";
import { extractText, getDocumentProxy } from "unpdf";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../../shared/database/prisma";
import { redis } from "../../shared/redis/client";
import { AiSummaryJob } from "./ai-summary.types";

// ─── Gemini client ────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Trích xuất text từ PDF và làm sạch.
 * Trả về null nếu PDF không có text (scan/ảnh).
 */
const extractTextFromPdf = async (pdfPath: string): Promise<string | null> => {
  const buffer = fs.readFileSync(pdfPath);

  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });

  if (!text || text.trim().length < 50) {
    return null;
  }

  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length > 16000 ? cleaned.slice(0, 16000) + "..." : cleaned;
};

/**
 * Gọi Gemini API để tóm tắt nội dung workshop.
 */
const generateSummary = async (
  text: string,
  workshopTitle: string,
): Promise<string> => {
  const prompt = `Bạn là trợ lý tóm tắt nội dung workshop cho sinh viên đại học Việt Nam.

Hãy tóm tắt nội dung workshop "${workshopTitle}" dưới đây trong 3–5 câu bằng tiếng Việt.
Nêu rõ: (1) chủ đề chính của workshop, (2) những gì sinh viên sẽ học được, (3) đối tượng phù hợp.
Viết ngắn gọn, dễ hiểu, không dùng bullet points.

Nội dung:
${text}`;

  const result = await geminiModel.generateContent(prompt);
  const summary = result.response.text().trim();

  if (!summary) {
    throw new Error("Gemini trả về kết quả rỗng.");
  }

  return summary;
};

// ─── Worker ───────────────────────────────────────────────────────────────────

export const startAiSummaryWorker = () => {
  const worker = new Worker<AiSummaryJob>(
    "ai-summary",
    async (job: Job<AiSummaryJob>) => {
      const { workshopId, pdfPath } = job.data;

      console.log(
        `[AiSummaryWorker] Processing job ${job.id} for workshop ${workshopId}`,
      );

      // 1. Kiểm tra workshop còn tồn tại và chưa bị hủy
      const workshop = await prisma.workshop.findUnique({
        where: { id: workshopId },
        select: { id: true, title: true, status: true },
      });

      if (!workshop || workshop.status === "cancelled") {
        console.log(
          `[AiSummaryWorker] Workshop ${workshopId} không tồn tại hoặc đã hủy → skip`,
        );
        return;
      }

      // 2. Kiểm tra file PDF còn tồn tại
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF file không tồn tại: ${pdfPath}`);
      }

      // 3. Trích xuất text từ PDF
      await job.updateProgress(20);
      const text = await extractTextFromPdf(pdfPath);

      if (!text) {
        // PDF scan/ảnh → không thể trích xuất
        await prisma.workshop.update({
          where: { id: workshopId },
          data: {
            aiSummary:
              "Không thể trích xuất nội dung từ PDF này (có thể là file scan).",
          },
        });
        console.log(
          `[AiSummaryWorker] PDF không có text cho workshop ${workshopId}`,
        );
        return;
      }

      // 4. Gọi Gemini API
      await job.updateProgress(50);
      console.log(
        `[AiSummaryWorker] Calling Gemini for workshop ${workshopId}...`,
      );

      const summary = await generateSummary(text, workshop.title);

      // 5. Lưu summary vào DB
      await job.updateProgress(90);
      await prisma.workshop.update({
        where: { id: workshopId },
        data: { aiSummary: summary },
      });

      await job.updateProgress(100);
      console.log(`[AiSummaryWorker] Done for workshop ${workshopId}`);
    },
    {
      connection: redis,
      concurrency: 2, // xử lý tối đa 2 job cùng lúc
    },
  );

  worker.on("completed", (job) => {
    console.log(`[AiSummaryWorker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[AiSummaryWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`,
      err.message,
    );

    // Sau lần retry cuối → lưu trạng thái thất bại vào DB
    if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
      prisma.workshop
        .update({
          where: { id: job.data.workshopId },
          data: { aiSummary: null }, // null = failed, UI hiển thị badge lỗi
        })
        .catch(console.error);
    }
  });

  console.log("AiSummaryWorker started");
  return worker;
};
