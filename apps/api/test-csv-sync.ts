import { Queue } from "bullmq";
import IORedis from "ioredis";

// Kết nối với redis
const redis = new IORedis("redis://localhost:6379", { maxRetriesPerRequest: null });
const csvImportQueue = new Queue("csv-import-queue", { connection: redis });

async function triggerJob() {
  console.log("🚀 Đang gửi yêu cầu trigger Job CsvImportWorker...");
  const files = [
    "data/students.csv",
  ];

  for (const file of files) {
    await csvImportQueue.add("import-csv-job", { filePath: file });
    console.log(`✅ Đã đưa job cho file ${file} vào hàng đợi thành công!`);
  }

  console.log("👉 Hãy xem log ở Terminal đang chạy 'npm run dev:api' để thấy kết quả.");

  // Đóng connection để script thoát
  setTimeout(() => {
    redis.quit();
    process.exit(0);
  }, 1000);
}

triggerJob().catch(console.error);
