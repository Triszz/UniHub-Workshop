import { checkinDB } from "./checkinDatabase";
import { deviceIdManager } from "../deviceIdManager";
import { api } from "../api";
import { OfflineCheckinRecord, SyncCheckinsResponse } from "../../types/checkin";

/**
 * Exponential backoff retry configuration
 */
interface ExponentialBackoffConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_BACKOFF_CONFIG: ExponentialBackoffConfig = {
  maxRetries: 5,
  initialDelayMs: 5000, // 5 seconds
  maxDelayMs: 60000, // 60 seconds
};

/**
 * Sync Manager for Offline Check-ins
 * Handles batching, network detection, and exponential backoff
 */
export class CheckinSyncManager {
  private static instance: CheckinSyncManager;
  private isSyncing = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private backoffConfig: ExponentialBackoffConfig;

  private constructor() {
    this.backoffConfig = DEFAULT_BACKOFF_CONFIG;
  }

  static getInstance(): CheckinSyncManager {
    if (!CheckinSyncManager.instance) {
      CheckinSyncManager.instance = new CheckinSyncManager();
    }
    return CheckinSyncManager.instance;
  }

  /**
   * Start sync when network is available
   */
  async syncWhenOnline(): Promise<void> {
    if (this.isSyncing) {
      console.log("⏳ Sync already in progress");
      return;
    }

    try {
      await this.performSync();
      this.retryCount = 0; // Reset on success
    } catch (error) {
      console.error("❌ Sync failed:", error);
      this.scheduleRetry();
    }
  }

  /**
   * Perform actual sync operation
   */
  private async performSync(): Promise<void> {
    this.isSyncing = true;
    this.clearRetryTimer();

    try {
      const pendingRecords = await checkinDB.getPendingCheckins();

      if (pendingRecords.length === 0) {
        console.log("✅ No pending records to sync");
        this.isSyncing = false;
        return;
      }

      console.log(`📤 Syncing ${pendingRecords.length} check-in records...`);

      // Prepare batch records
      const deviceId = await deviceIdManager.getDeviceId();
      const recordsToSync: OfflineCheckinRecord[] = pendingRecords.map(
        (r: any) => ({
          qrCode: r.qr_code,
          checkedInAt: r.checked_in_at,
          deviceId: r.device_id || deviceId,
        })
      );

      // Call API
      const response = await this.callSyncApi(recordsToSync);

      // Update database with synced records
      if (response.synced.length > 0) {
        await checkinDB.markMultipleSynced(response.synced);
        console.log(
          `✅ ${response.synced.length} records synced successfully`
        );
      }

      // Log skipped and failed
      if (response.skipped.length > 0) {
        console.log(
          `⏭️  ${response.skipped.length} records already checked in (skipped)`
        );
      }

      if (response.failed.length > 0) {
        console.warn(
          `⚠️  ${response.failed.length} records failed:`,
          response.failed
        );
      }
    } catch (error: any) {
      console.error("Sync operation failed:", error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Call API to sync records
   */
  private async callSyncApi(
    records: OfflineCheckinRecord[]
  ): Promise<SyncCheckinsResponse> {
    try {
      // Server expect body là array trực tiếp (không wrap trong object)
      const response = await api.post("/checkins/sync", records);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Auth error - don't retry
        throw new Error("Authentication failed - please re-login");
      }
      // Network error or other issues - will be retried
      throw error;
    }
  }

  /**
   * Schedule retry with exponential backoff
   */
  private scheduleRetry(): void {
    if (this.retryCount >= this.backoffConfig.maxRetries) {
      console.error(
        `❌ Max retries (${this.backoffConfig.maxRetries}) reached. Sync stopped.`
      );
      return;
    }

    const delay = Math.min(
      this.backoffConfig.initialDelayMs * Math.pow(2, this.retryCount),
      this.backoffConfig.maxDelayMs
    );

    this.retryCount++;
    console.log(
      `🔄 Scheduling retry #${this.retryCount} in ${delay}ms...`
    );

    this.syncTimer = setTimeout(() => {
      this.syncWhenOnline();
    }, delay);
  }

  /**
   * Clear retry timer
   */
  private clearRetryTimer(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Get sync status
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearRetryTimer();
    this.isSyncing = false;
  }
}

export const checkinSyncManager = CheckinSyncManager.getInstance();
