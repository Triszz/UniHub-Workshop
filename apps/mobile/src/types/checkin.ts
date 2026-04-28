// QR Code JWT Payload
export interface QrPayload {
  sub: string; // registration ID
  workshopId: string;
  userId: string;
  type: "workshop_qr";
  exp?: number; // expiration timestamp
}

// Check-in result
export interface CheckInResult {
  success: boolean;
  studentName: string;
  studentId?: string;
  workshopTitle: string;
  checkedInAt: string;
  message?: string;
  error?: string;
}

// API sync response
export interface SyncCheckinsResponse {
  synced: string[]; // QR codes that were synced
  skipped: string[]; // QR codes already checked in
  failed: Array<{ qrCode: string; reason: string }>;
  summary: {
    total: number;
    synced: number;
    skipped: number;
    failed: number;
  };
}

// Offline check-in record
export interface OfflineCheckinRecord {
  qrCode: string;
  checkedInAt: string; // ISO 8601
  deviceId?: string;
}
