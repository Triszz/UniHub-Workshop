// Một record trong batch sync từ mobile
export interface OfflineCheckinRecord {
  qrCode: string;
  checkedInAt: string; // ISO8601
  deviceId?: string;
}
