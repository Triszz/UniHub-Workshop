import * as Network from "expo-network";
import { api } from "../api";
import {
  getUnsyncedCheckins,
  markAsSynced,
  CheckinRecord,
} from "./checkinQueue";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  skipped: number;
  failed: number;
  errors: Array<{ qrCode: string; reason: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;

// Exponential backoff: 5s → 10s → 20s → 40s (tối đa 4 lần retry)
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000];

// ─── State ────────────────────────────────────────────────────────────────────

let isSyncing = false;

// ─── Main sync function ───────────────────────────────────────────────────────

/**
 * Đồng bộ tất cả offline check-ins lên server.
 *
 * Gọi khi:
 *  1. App detect network trở lại online (NetInfo / expo-network event)
 *  2. Ngay sau khi một online check-in thất bại (fallback sang offline)
 *
 * Idempotent: gọi nhiều lần với cùng data → server dùng ON CONFLICT DO NOTHING,
 * client chỉ mark synced=1 cho những QR được server xác nhận.
 */
export const syncOfflineCheckins = async (): Promise<SyncResult> => {
  const result: SyncResult = { synced: 0, skipped: 0, failed: 0, errors: [] };

  // Tránh chạy đồng thời nhiều sync
  if (isSyncing) {
    console.log("⏳ Sync already in progress, skipping.");
    return result;
  }

  isSyncing = true;

  try {
    // 1. Kiểm tra kết nối mạng
    const network = await Network.getNetworkStateAsync();
    if (!network.isConnected || !network.isInternetReachable) {
      console.log("📵 No network, sync skipped.");
      return result;
    }

    // 2. Lấy tất cả check-in chưa sync từ SQLite
    const unsynced: CheckinRecord[] = await getUnsyncedCheckins();
    if (unsynced.length === 0) {
      return result;
    }

    console.log(`📡 Starting sync: ${unsynced.length} pending check-in(s)...`);

    // 3. Gửi theo batch
    for (let i = 0; i < unsynced.length; i += BATCH_SIZE) {
      const batch = unsynced.slice(i, i + BATCH_SIZE);
      await syncBatchWithRetry(batch, result);
    }

    console.log(
      `✅ Sync complete — synced: ${result.synced}, ` +
        `skipped: ${result.skipped}, failed: ${result.failed}`,
    );
  } catch (err) {
    // Lỗi ngoài dự kiến (VD: SQLite unavailable) — không crash app
    console.error("❌ Unexpected sync error:", err);
  } finally {
    isSyncing = false;
  }

  return result;
};

// ─── Batch sync với exponential backoff retry ─────────────────────────────────

const syncBatchWithRetry = async (
  batch: CheckinRecord[],
  result: SyncResult,
  retryIndex = 0,
): Promise<void> => {
  try {
    const payload = batch.map((r) => ({
      qrCode: r.qrCode,
      checkedInAt: r.checkedInAt,
      deviceId: r.deviceId,
    }));

    // POST /api/v1/checkins/sync
    // Server trả về:
    // { synced: string[], skipped: string[], failed: [{qrCode, reason}] }
    const { data } = await api.post<{
      synced: string[];
      skipped: string[];
      failed: Array<{ qrCode: string; reason: string }>;
    }>("/checkins/sync", payload);

    // Mark thành công trong SQLite
    const confirmedQrs = [...(data.synced ?? []), ...(data.skipped ?? [])];
    if (confirmedQrs.length > 0) {
      await markAsSynced(confirmedQrs);
    }

    result.synced += data.synced?.length ?? 0;
    result.skipped += data.skipped?.length ?? 0;
    result.failed += data.failed?.length ?? 0;

    if (data.failed?.length) {
      result.errors.push(...data.failed);
      console.warn("⚠️ Some check-ins failed on server:", data.failed);
    }
  } catch (err: any) {
    const isNetworkError =
      !err.response ||
      err.code === "ECONNABORTED" ||
      err.code === "ERR_NETWORK";

    // Nếu là lỗi mạng và còn lần retry → backoff rồi thử lại
    if (isNetworkError && retryIndex < RETRY_DELAYS_MS.length) {
      const delay = RETRY_DELAYS_MS[retryIndex];
      console.warn(
        `🔄 Sync batch failed (attempt ${retryIndex + 1}), ` +
          `retrying in ${delay / 1000}s...`,
      );
      await sleep(delay);
      return syncBatchWithRetry(batch, result, retryIndex + 1);
    }

    // Hết retry hoặc lỗi server (4xx/5xx) → đánh dấu failed, KHÔNG xóa SQLite
    // Data vẫn còn đó, lần sync tiếp theo sẽ thử lại
    result.failed += batch.length;
    result.errors.push(
      ...batch.map((r) => ({
        qrCode: r.qrCode,
        reason: err.response?.data?.error ?? err.message ?? "Unknown error",
      })),
    );
    console.error(
      `❌ Batch sync failed permanently after retries:`,
      err.message,
    );
  }
};

// ─── Utility ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
