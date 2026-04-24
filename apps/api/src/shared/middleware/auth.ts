import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { redis } from "../redis/client";
import { JwtPayload, Role } from "../../modules/auth/auth.types";

const JWT_SECRET = process.env.JWT_SECRET!;

// ─── verifyJWT ────────────────────────────────────────────────────────────────

/**
 * Middleware xác thực JWT.
 * Gắn req.user = { id, role, email } nếu token hợp lệ.
 */
export const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Thiếu token xác thực." });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };

    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      res.status(401).json({
        error: "Token đã hết hạn. Vui lòng làm mới token.",
        code: "TOKEN_EXPIRED",
      });
      return;
    }
    res.status(401).json({ error: "Token không hợp lệ." });
  }
};

// ─── requireRole ─────────────────────────────────────────────────────────────

/**
 * Middleware kiểm tra role.
 * Luôn dùng SAU verifyJWT.
 *
 * @example
 * router.post("/workshops", verifyJWT, requireRole("organizer"), createWorkshop);
 * router.get("/me", verifyJWT, requireRole("student", "organizer"), getMe);
 */
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Chưa xác thực." });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: "Bạn không có quyền thực hiện hành động này.",
      });
      return;
    }

    next();
  };

// ─── loginRateLimit ───────────────────────────────────────────────────────────

/**
 * Rate limit riêng cho endpoint đăng nhập: 5 lần / phút / IP.
 * Dùng Redis INCR + EXPIRE (đơn giản hơn Token Bucket vì chỉ cần
 * chặn brute force, không cần burst control).
 */
export const loginRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Lấy IP thật khi đứng sau reverse proxy (Nginx)
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
    req.ip ??
    "unknown";

  const key = `login_attempts:${ip}`;
  const MAX_ATTEMPTS = 5;
  const WINDOW_SEC = 60;

  try {
    const attempts = await redis.incr(key);

    // Lần đầu → set TTL
    if (attempts === 1) {
      await redis.expire(key, WINDOW_SEC);
    }

    if (attempts > MAX_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      res.status(429).json({
        error: `Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau ${ttl} giây.`,
        retryAfter: ttl,
      });
      return;
    }

    next();
  } catch (redisErr) {
    // Nếu Redis lỗi → cho qua (fail open), không chặn đăng nhập
    console.error("[loginRateLimit] Redis error:", redisErr);
    next();
  }
};
