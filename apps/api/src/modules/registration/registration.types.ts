export type RegistrationStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "checked_in";

// Body POST /registrations
export interface CreateRegistrationDto {
  workshopId: string;
}

// Payload bên trong QR JWT
export interface QrPayload {
  sub: string; // registration.id
  workshopId: string;
  userId: string;
  type: "workshop_qr"; // phân biệt với auth JWT
}
