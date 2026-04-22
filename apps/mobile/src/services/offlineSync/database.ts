import * as SQLite from "expo-sqlite";

// Mở database theo chuẩn mới (Synchronous)
const db = SQLite.openDatabaseSync("unihub.db");

/**
 * Khởi tạo schema SQLite local
 * Gọi 1 lần khi app khởi động
 */
export const initDatabase = async (): Promise<void> => {
  try {
    // execAsync cho phép chạy thẳng câu lệnh SQL mà không cần mở transaction rườm rà
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS checkins (
        id TEXT PRIMARY KEY,
        qr_code TEXT NOT NULL UNIQUE,
        checked_in_at TEXT NOT NULL,
        device_id TEXT,
        synced INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    console.log("✅ SQLite: checkins table ready");
  } catch (error) {
    console.error("❌ SQLite init error:", error);
    throw error; // Ném lỗi ra ngoài để component cha xử lý nếu cần
  }
};

export { db };
