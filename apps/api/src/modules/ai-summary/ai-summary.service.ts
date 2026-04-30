import fs from "fs";
import path from "path";
import { prisma } from "../../shared/database/prisma";
import { aiSummaryQueue } from "../../shared/queue/queue";

// ─── Constants ────────────────────────────────────────────────────────────────

// Thư mục lưu file PDF upload
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "pdfs");

const appError = (message: string, status: number) =>
  Object.assign(new Error(message), { status });

// Tạo thư mục upload nếu chưa có
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ─── Service: POST /admin/workshops/:id/pdf ───────────────────────────────────

export const uploadPdfAndEnqueue = async (
  workshopId: string,
  file: Express.Multer.File,
) => {
  // 1. Validate workshop tồn tại
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { id: true, title: true, status: true, pdfUrl: true },
  });

  if (!workshop) throw appError("Workshop không tồn tại.", 404);
  if (workshop.status === "cancelled") {
    throw appError("Không thể upload PDF cho workshop đã hủy.", 400);
  }

  // 2. Xóa file PDF cũ nếu có
  if (workshop.pdfUrl) {
    const oldPath = path.join(
      process.cwd(),
      workshop.pdfUrl.replace(/^\//, ""),
    );
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  // 3. Lưu file mới với tên cố định theo workshopId
  const filename = `${workshopId}-${Date.now()}.pdf`;
  const savePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(savePath, file.buffer);

  const pdfUrl = `/uploads/pdfs/${filename}`;

  // 4. Cập nhật DB: pdfUrl + reset aiSummary về null (đang xử lý)
  await prisma.workshop.update({
    where: { id: workshopId },
    data: {
      pdfUrl,
      aiSummary: null, // null = đang xử lý → UI hiện loading
    },
  });

  // 5. Enqueue job
  const job = await aiSummaryQueue.add(
    "generate",
    { workshopId, pdfPath: savePath },
    { jobId: `ai-summary-${workshopId}` }, // jobId cố định → tránh enqueue trùng
  );

  console.log(`[AiSummary] Enqueued job ${job.id} for workshop ${workshopId}`);

  return {
    message: "File đã được tải lên. Tóm tắt AI đang được tạo...",
    pdfUrl,
    jobId: job.id,
  };
};

// ─── Service: POST /admin/workshops/:id/ai-summary/retry ─────────────────────

export const retryAiSummary = async (workshopId: string) => {
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { id: true, pdfUrl: true, status: true },
  });

  if (!workshop) throw appError("Workshop không tồn tại.", 404);
  if (!workshop.pdfUrl) {
    throw appError("Chưa có file PDF. Vui lòng upload trước.", 400);
  }
  if (workshop.status === "cancelled") {
    throw appError("Workshop đã bị hủy.", 400);
  }

  const pdfPath = path.join(process.cwd(), workshop.pdfUrl.replace(/^\//, ""));

  if (!require("fs").existsSync(pdfPath)) {
    throw appError("File PDF không còn tồn tại. Vui lòng upload lại.", 400);
  }

  // Reset summary về null → UI hiện loading
  await prisma.workshop.update({
    where: { id: workshopId },
    data: { aiSummary: null },
  });

  // Xóa job cũ nếu còn trong queue, tạo job mới
  await aiSummaryQueue.remove(`ai-summary-${workshopId}`).catch(() => {});

  const job = await aiSummaryQueue.add(
    "generate",
    { workshopId, pdfPath },
    { jobId: `ai-summary-${workshopId}` },
  );

  return {
    message: "Đang tạo lại tóm tắt AI...",
    jobId: job.id,
  };
};

// ─── Service: GET job status ──────────────────────────────────────────────────

export const getAiSummaryStatus = async (workshopId: string) => {
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { aiSummary: true, pdfUrl: true },
  });

  if (!workshop) throw appError("Workshop không tồn tại.", 404);

  // Kiểm tra job trong queue
  const job = await aiSummaryQueue.getJob(`ai-summary-${workshopId}`);
  const jobState = job ? await job.getState() : null;

  return {
    pdfUrl: workshop.pdfUrl,
    aiSummary: workshop.aiSummary,
    // pending = đang chờ/xử lý; completed/null = xem aiSummary; failed = lỗi
    jobState,
  };
};
