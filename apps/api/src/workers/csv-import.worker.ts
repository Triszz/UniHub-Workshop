import { Queue, Worker } from "bullmq";
import fs from "fs";
import path from "path";
import readline from "readline";
import bcrypt from "bcrypt";
import { redis } from "../shared/redis/client";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const QUEUE_NAME = "csv-import-queue";

// 1. Initialize Queue
export const csvImportQueue = new Queue(QUEUE_NAME, {
  connection: redis,
});

// 2. Setup Cron Job
export const setupCsvImportCron = async () => {
  const repeatableJobs = await csvImportQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await csvImportQueue.removeRepeatableByKey(job.key);
  }

  await csvImportQueue.add(
    "import-csv-job",
    {},
    { repeat: { pattern: "0 2 * * *" } }
  );
  console.log("Cron job CsvImportWorker scheduled at 02:00 AM");
};

// 3. Setup Worker
export const csvImportWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    console.log(`[CsvImportWorker] Bắt đầu xử lý job ${job.id}`);

    const filePath = job.data?.filePath || "/data/students.csv";
    const localFilePath = path.join(process.cwd(), filePath.startsWith('/') ? filePath.substring(1) : filePath);
    const targetFile = fs.existsSync(filePath) ? filePath : localFilePath;

    const log = await prisma.csvImportLog.create({
      data: {
        filename: targetFile,
        status: "processing",
        startedAt: new Date(),
      },
    });

    if (!fs.existsSync(targetFile)) {
      // console.log(`[CsvImportWorker] Không tìm thấy file: ${targetFile}`);
      await prisma.csvImportLog.update({
        where: { id: log.id },
        data: { status: "failed", errors: { message: "File not found" }, completedAt: new Date() },
      });
      return;
    }
    // console.log(`[CsvImportWorker] Đang tạo Hash Password mặc định...`);
    const defaultPasswordHash = await bcrypt.hash("Password123!", 12);
    console.log(`[CsvImportWorker] Tạo Hash thành công! Bắt đầu đọc file...`);
    // BỌC TRY...CATCH TOÀN CỤC Ở ĐÂY ĐỂ BẮT LỖI CRASH NGẦM
    try {
      const fileStream = fs.createReadStream(targetFile);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      let isFirstLine = true;
      let headers: string[] = [];
      const expectedHeaders = ["student_id", "full_name", "email", "faculty", "year"];

      let totalRows = 0;
      let importedRows = 0;
      let skippedRows = 0;
      let errorRows = 0;
      const errors: any[] = [];

      for await (const line of rl) {
        if (!line.trim()) continue;

        if (isFirstLine) {
          headers = line.split(",").map((h) => h.trim().toLowerCase());
          isFirstLine = false;

          let headerOrderValid = true;
          for (let i = 0; i < expectedHeaders.length; i++) {
            if (headers[i] !== expectedHeaders[i]) {
              headerOrderValid = false;
              break;
            }
          }

          if (!headerOrderValid) {
            console.log(`[CsvImportWorker] ❌ Sai cấu trúc Header!`);
            await prisma.csvImportLog.update({
              where: { id: log.id },
              data: {
                status: "failed",
                errors: { message: `Invalid headers. Expected: ${expectedHeaders.join(", ")}` },
                completedAt: new Date(),
              },
            });
            return;
          }
          continue;
        }

        totalRows++;
        // console.log(`[CsvImportWorker] Đang xử lý dòng ${totalRows}...`);

        // Tạm thời dùng split cơ bản thay vì Regex để tránh lỗi lặp vô hạn (catastrophic backtracking)
        const values = line.split(",").map((v) => v.trim());
        const rowObj: any = {};
        headers.forEach((h, i) => {
          rowObj[h] = values[i] || "";
        });

        // Validations
        const errorsForRow: string[] = [];
        if (!/^SV\d{8}$/.test(rowObj.student_id)) errorsForRow.push("Invalid student_id");
        if (!rowObj.email || !rowObj.email.endsWith("@university.edu.vn")) errorsForRow.push("Invalid email");
        if (!rowObj.full_name) errorsForRow.push("Invalid full_name");

        const yearNum = parseInt(rowObj.year);
        if (isNaN(yearNum) || yearNum < 1 || yearNum > 6) errorsForRow.push("Invalid year");

        if (errorsForRow.length > 0) {
          // console.log(`[CsvImportWorker] Dòng ${totalRows} dính lỗi validate:`, errorsForRow);
          errors.push({ row: totalRows, student_id: rowObj.student_id, message: errorsForRow.join(", ") });
          errorRows++;
          continue;
        }

        try {
          // console.log(`[CsvImportWorker] Đang lưu dòng ${totalRows} (student: ${rowObj.student_id}) vào DB...`);

          const existingByEmail = await prisma.user.findUnique({
            where: { email: rowObj.email },
            select: { studentId: true }
          });

          if (existingByEmail && existingByEmail.studentId !== rowObj.student_id) {
            errors.push({ row: totalRows, student_id: rowObj.student_id, message: "Email conflict" });
            errorRows++;
            continue;
          }

          await prisma.user.upsert({
            where: { studentId: rowObj.student_id },
            update: {
              fullName: rowObj.full_name,
              faculty: rowObj.faculty,
              year: yearNum,
            },
            create: {
              studentId: rowObj.student_id,
              email: rowObj.email,
              fullName: rowObj.full_name,
              faculty: rowObj.faculty,
              year: yearNum,
              role: "student",
              passwordHash: defaultPasswordHash,
            },
          });
          importedRows++;
        } catch (dbErr: any) {
          // console.log(`[CsvImportWorker] Lỗi DB tại dòng ${totalRows}: ${dbErr.message}`);
          errors.push({ row: totalRows, message: dbErr.message });
          errorRows++;
        }
      }

      // console.log(`[CsvImportWorker] Đã duyệt xong file. Đang cập nhật trạng thái log thành completed...`);
      await prisma.csvImportLog.update({
        where: { id: log.id },
        data: {
          status: "completed",
          totalRows,
          importedRows,
          skippedRows,
          errorRows,
          errors: errors.length > 0 ? errors : undefined,
          completedAt: new Date(),
        },
      });
      console.log(`[CsvImportWorker] Job ${job.id} hoàn tất! Rows: ${importedRows}`);

    } catch (globalError: any) {
      // ĐÂY CHÍNH LÀ NƠI BẮT ĐƯỢC THỦ PHẠM GÂY "TREO"
      // console.error(`[CsvImportWorker] CRASH NGẦM TOÀN CỤC:`, globalError);

      // Bắt buộc update trạng thái về failed để không bị kẹt processing
      await prisma.csvImportLog.update({
        where: { id: log.id },
        data: {
          status: "failed",
          errors: { message: globalError.message || "Unknown fatal error" },
          completedAt: new Date(),
        },
      }).catch(e => console.error("Không thể update status thành failed:", e.message));

      throw globalError; // Ném lỗi ra cho BullMQ biết là job xịt
    }
  },
  { connection: redis }
);

csvImportWorker.on("failed", (job, err) => {
  console.error(`[CsvImportWorker] Job ${job?.id} failed: ${err.message}`);
});
