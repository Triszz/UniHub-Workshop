import { db } from "./database";
import * as Crypto from "expo-crypto";

export interface CheckinRecord {
  id: string;
  qrCode: string;
  checkedInAt: string;
  deviceId: string;
  synced: boolean;
}

/**
 * Lưu check-in vào SQLite local (offline hoặc backup)
 */
export const saveCheckinLocally = async (
  qrCode: string,
  deviceId: string,
): Promise<CheckinRecord> => {
  // Trong expo-crypto mới, hàm randomUUID() chạy đồng bộ (không cần await)
  const id = Crypto.randomUUID();
  const checkedInAt = new Date().toISOString();

  // 1. Kiểm tra trùng trước khi insert (getFirstAsync thay thế cho SELECT)
  const existing = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM checkins WHERE qr_code = ?",
    [qrCode],
  );

  if (existing) {
    throw new Error("QR_ALREADY_CHECKED_IN");
  }

  // 2. Insert dữ liệu (runAsync dùng cho INSERT, UPDATE, DELETE)
  await db.runAsync(
    "INSERT INTO checkins (id, qr_code, checked_in_at, device_id, synced) VALUES (?, ?, ?, ?, 0)",
    [id, qrCode, checkedInAt, deviceId],
  );

  return { id, qrCode, checkedInAt, deviceId, synced: false };
};

/**
 * Lấy tất cả check-in chưa sync
 */
export const getUnsyncedCheckins = async (): Promise<CheckinRecord[]> => {
  // getAllAsync sẽ trả về thẳng một mảng object, không cần vòng lặp for thủ công nữa
  const rows = await db.getAllAsync<{
    id: string;
    qr_code: string;
    checked_in_at: string;
    device_id: string;
    synced: number;
  }>("SELECT * FROM checkins WHERE synced = 0 ORDER BY checked_in_at ASC");

  // Map lại tên trường (field) từ snake_case của DB sang camelCase của TypeScript
  return rows.map((row) => ({
    id: row.id,
    qrCode: row.qr_code,
    checkedInAt: row.checked_in_at,
    deviceId: row.device_id,
    synced: row.synced === 1,
  }));
};

/**
 * Đánh dấu check-in đã sync thành công
 */
export const markAsSynced = async (qrCodes: string[]): Promise<void> => {
  if (qrCodes.length === 0) return;

  const placeholders = qrCodes.map(() => "?").join(",");

  await db.runAsync(
    `UPDATE checkins SET synced = 1 WHERE qr_code IN (${placeholders})`,
    qrCodes,
  );
};
