import * as SQLite from "expo-sqlite";

/**
 * SQLite Database Manager for offline check-ins
 * Schema: checkins table with columns for local dedup and sync
 */

const DB_NAME = "unihub_checkin.db";

interface CheckinRecord {
  id: string;
  qr_code: string;
  registration_id: string;
  device_id: string;
  checked_in_at: string; // ISO 8601
  synced: 0 | 1; // 0 = pending, 1 = synced
  created_at: string;
}

export class CheckinDatabase {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);

      // Enable foreign keys
      await this.db.execAsync("PRAGMA foreign_keys = ON;");

      // Create checkins table if not exists
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS checkins (
          id TEXT PRIMARY KEY,
          qr_code TEXT NOT NULL UNIQUE,
          registration_id TEXT NOT NULL UNIQUE,
          device_id TEXT,
          checked_in_at TEXT NOT NULL,
          synced INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_registration_id ON checkins(registration_id);
        CREATE INDEX IF NOT EXISTS idx_synced ON checkins(synced);
        CREATE INDEX IF NOT EXISTS idx_checked_in_at ON checkins(checked_in_at);
      `);

      console.log("✅ CheckinDatabase initialized");
    } catch (error) {
      console.error("❌ Error initializing database:", error);
      throw error;
    }
  }

  /**
   * Check if registration already exists (local dedup)
   */
  async hasCheckin(registrationId: string): Promise<boolean> {
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.getFirstAsync(
      "SELECT COUNT(*) as count FROM checkins WHERE registration_id = ?",
      [registrationId]
    );

    return (result as { count: number }).count > 0;
  }

  /**
   * Insert new check-in record
   */
  async insertCheckin(
    qrCode: string,
    registrationId: string,
    deviceId: string,
    checkedInAt: string
  ): Promise<CheckinRecord> {
    if (!this.db) throw new Error("Database not initialized");

    const id = `checkin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO checkins (id, qr_code, registration_id, device_id, checked_in_at, synced, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, qrCode, registrationId, deviceId, checkedInAt, 0, createdAt]
    );

    return {
      id,
      qr_code: qrCode,
      registration_id: registrationId,
      device_id: deviceId,
      checked_in_at: checkedInAt,
      synced: 0,
      created_at: createdAt,
    };
  }

  /**
   * Get all pending check-ins (synced = 0)
   */
  async getPendingCheckins(): Promise<CheckinRecord[]> {
    if (!this.db) throw new Error("Database not initialized");

    const records = await this.db.getAllAsync(
      "SELECT * FROM checkins WHERE synced = 0 ORDER BY created_at ASC LIMIT 50"
    );

    return records as CheckinRecord[];
  }

  /**
   * Mark check-in as synced
   */
  async markSynced(qrCode: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.runAsync("UPDATE checkins SET synced = 1 WHERE qr_code = ?", [
      qrCode,
    ]);
  }

  /**
   * Mark multiple check-ins as synced
   */
  async markMultipleSynced(qrCodes: string[]): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    const placeholders = qrCodes.map(() => "?").join(",");
    await this.db.runAsync(
      `UPDATE checkins SET synced = 1 WHERE qr_code IN (${placeholders})`,
      qrCodes
    );
  }

  /**
   * Delete a check-in record
   */
  async deleteCheckin(qrCode: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.runAsync("DELETE FROM checkins WHERE qr_code = ?", [qrCode]);
  }

  /**
   * Clear all synced records (cleanup)
   */
  async clearSyncedRecords(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.runAsync("DELETE FROM checkins WHERE synced = 1");
  }

  /**
   * Get total pending count
   */
  async getPendingCount(): Promise<number> {
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.getFirstAsync(
      "SELECT COUNT(*) as count FROM checkins WHERE synced = 0"
    );

    return (result as { count: number }).count;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

// Singleton instance
export const checkinDB = new CheckinDatabase();
