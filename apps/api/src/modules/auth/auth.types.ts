export type Role = "student" | "organizer" | "checkin_staff";

export interface JwtPayload {
  sub: string; // user id
  role: Role;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Object gắn vào req.user sau khi verifyJWT middleware chạy xong.
 */
export interface AuthenticatedUser {
  id: string;
  role: Role;
  email: string;
}

// Mở rộng Express Request interface để TypeScript nhận ra req.user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
