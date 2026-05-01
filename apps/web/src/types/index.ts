export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "student" | "organizer" | "checkin_staff";
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface RefreshResponse {
  access_token: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
}

export type WorkshopStatus = "draft" | "published" | "cancelled";

export interface Room {
  id: string;
  name: string;
  building?: string;
  capacity?: number;
}

export interface Workshop {
  id: string;
  title: string;
  description?: string;
  speakerName?: string;
  speakerBio?: string;
  capacity: number;
  registeredCount: number;
  startsAt: string;
  endsAt: string;
  price: number;
  status: WorkshopStatus;
  aiSummary?: string | null;
  pdfUrl?: string | null;
  room: Room;
}

export type AiSummaryJobState =
  | "active"
  | "completed"
  | "delayed"
  | "failed"
  | "paused"
  | "prioritized"
  | "unknown"
  | "waiting"
  | "waiting-children"
  | null;

export interface AiSummaryStatus {
  pdfUrl: string | null;
  aiSummary: string | null;
  jobState: AiSummaryJobState;
}

export interface AiSummaryActionResponse {
  message: string;
  pdfUrl?: string;
  jobId?: string | number;
}

export interface WorkshopFormData {
  title: string;
  description?: string;
  speakerName?: string;
  speakerBio?: string;
  roomId: string;
  capacity: number;
  startsAt: string;
  endsAt: string;
  price: number;
  status: "draft" | "published";
}

export interface WorkshopListResponse {
  workshops: Workshop[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CancelWorkshopResponse {
  cancelled: boolean;
  affectedRegistrations: number;
}

/* Admin Stats */

export interface WorkshopStatsResponse {
  workshop: {
    id: string;
    title: string;
    capacity: number;
    status: WorkshopStatus;
    price: number;
  };
  registrations: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    checkedIn: number;
  };
  checkins: {
    total: number;
    rate: string;
    attendanceRate?: number;
  };
  revenue: {
    total: number;
    currency: string;
  };
}

export type AdminRegistrationFilter =
  | "all"
  | "pending"
  | "confirmed"
  | "checked_in"
  | "cancelled";

export interface AdminWorkshopRegistration {
  id: string;
  status: RegistrationStatus;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  payment?: {
    id: string;
    amount: number;
    status: string;
  } | null;
  checkin?: {
    checkedInAt: string;
    isOffline: boolean;
    deviceId?: string | null;
  } | null;
}

export interface AdminWorkshopRegistrationsResponse {
  workshop: { id: string; title: string };
  registrations: AdminWorkshopRegistration[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/* ─── Registration ─── */

export type RegistrationStatus = "confirmed" | "pending" | "cancelled" | "checked_in";

/** Room info returned by registration endpoints (no `id` field). */
export interface RegistrationRoomSummary {
  name?: string;
  building?: string;
}

export interface RegistrationWorkshopSummary {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  price?: number;
  capacity?: number;
  registeredCount?: number;
  room?: RegistrationRoomSummary;
}

export interface Registration {
  id: string;
  status: RegistrationStatus;
  qrCode?: string;
  createdAt: string;
  workshop?: RegistrationWorkshopSummary;
}

export interface RegistrationResponse {
  registration: Registration;
  checkoutUrl?: string;
  payment?: {
    id: string;
    amount: number;
    idempotency_key?: string;
  };
}

export interface RegistrationListResponse {
  registrations: Registration[];
}

/* Notifications */

export interface NotificationItem {
  id: string;
  type: string;
  channel?: string;
  payload?: {
    title?: string;
    message?: string;
    workshopTitle?: string;
    startsAt?: string;
    roomName?: string;
    [key: string]: unknown;
  };
  status: string;
  sentAt?: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  unreadCount?: number;
}

/* CSV Import Admin */

export type CsvImportStatus = "processing" | "completed" | "failed" | string;

export interface CsvImportLog {
  id: string;
  filename?: string | null;
  totalRows?: number | null;
  importedRows?: number | null;
  skippedRows?: number | null;
  errorRows?: number | null;
  errors?: unknown;
  status: CsvImportStatus;
  startedAt: string;
  completedAt?: string | null;
}
