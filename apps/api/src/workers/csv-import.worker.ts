import { Queue, Worker } from "bullmq";
import fs from "fs";
import path from "path";
import readline from "readline";
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
    console.log(`[CsvImportWorker] Processing job ${job.id}`);

    const filePath = "/data/students.csv";
    const localFilePath = path.join(process.cwd(), "data", "students.csv");
    const targetFile = fs.existsSync(filePath) ? filePath : localFilePath;

    const log = await prisma.csvImportLog.create({
      data: {
        filename: targetFile,
        status: "processing",
        startedAt: new Date(),
      },
    });

    if (!fs.existsSync(targetFile)) {
      await prisma.csvImportLog.update({
        where: { id: log.id },
        data: {
          status: "failed",
          errors: { message: "File not found" },
          completedAt: new Date(),
        },
      });
      console.log(`[CsvImportWorker] File not found`);
      return;
    }

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

        // Check columns in order
        let headerOrderValid = true;
        for (let i = 0; i < expectedHeaders.length; i++) {
          if (headers[i] !== expectedHeaders[i]) {
            headerOrderValid = false;
            break;
          }
        }

        if (!headerOrderValid) {
          await prisma.csvImportLog.update({
            where: { id: log.id },
            data: {
              status: "failed",
              errors: { message: `Invalid headers or order. Expected: ${expectedHeaders.join(", ")}` },
              completedAt: new Date(),
            },
          });
          return;
        }
        continue;
      }

      totalRows++;
      const values = line.split(",").map((v) => v.trim());
      const rowObj: any = {};
      headers.forEach((h, i) => {
        rowObj[h] = values[i] || "";
      });

      // Validations
      const errorsForRow: string[] = [];
      if (!/^SV\d{8}$/.test(rowObj.student_id)) {
        errorsForRow.push("Invalid student_id");
      }
      if (!rowObj.email || !rowObj.email.endsWith("@university.edu.vn")) {
        errorsForRow.push("Invalid email format/domain");
      }
      if (!rowObj.full_name || rowObj.full_name.length > 255) {
        errorsForRow.push("Invalid full_name");
      }
      const yearNum = parseInt(rowObj.year);
      if (isNaN(yearNum) || yearNum < 1 || yearNum > 6) {
        errorsForRow.push("Invalid year");
      }

      if (errorsForRow.length > 0) {
        errors.push({ row: totalRows, message: errorsForRow.join(", "), data: rowObj });
        errorRows++;
        continue;
      }

      try {
        const existingByEmail = await prisma.user.findUnique({
          where: { email: rowObj.email },
        });

        if (existingByEmail && existingByEmail.studentId !== rowObj.student_id) {
          errors.push({
            row: totalRows,
            message: "Email conflict with another student",
          });
          skippedRows++;
          continue;
        }

        const existingByStudentId = await prisma.user.findUnique({
          where: { studentId: rowObj.student_id },
        });

        if (existingByStudentId) {
          await prisma.user.update({
            where: { studentId: rowObj.student_id },
            data: {
              fullName: rowObj.full_name,
              faculty: rowObj.faculty,
              year: yearNum,
            },
          });
        } else {
          await prisma.user.create({
            data: {
              studentId: rowObj.student_id,
              email: rowObj.email,
              fullName: rowObj.full_name,
              faculty: rowObj.faculty,
              year: yearNum,
              role: "student",
            },
          });
        }

        importedRows++;
      } catch (dbErr: any) {
        errors.push({ row: totalRows, message: dbErr.message });
        errorRows++;
      }
    }

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

    console.log(`[CsvImportWorker] Job ${job.id} completed. Rows: ${importedRows}`);
  },
  { connection: redis }
);

csvImportWorker.on("failed", (job, err) => {
  console.error(`[CsvImportWorker] Job ${job?.id} failed: ${err.message}`);
});
