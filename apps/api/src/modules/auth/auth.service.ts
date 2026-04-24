import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../shared/database/prisma";
import { redis } from "../../shared/redis/client";
import { JwtPayload, Role } from "./auth.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "1h";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
const REFRESH_TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // 7 ngày tính bằng giây

// Redis key lưu hash của refresh token, per user
const refreshKey = (userId: string) => `refresh:${userId}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateAccessToken = (payload: Omit<JwtPayload, "iat" | "exp">) =>
  jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);

const generateRefreshToken = (payload: Omit<JwtPayload, "iat" | "exp">) =>
  jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);

// ─── Public service methods ───────────────────────────────────────────────────

/**
 * Đăng nhập — trả về access token, refresh token và thông tin user.
 * Throw Error với message cụ thể nếu thất bại.
 */
export const login = async (email: string, password: string) => {
  // 1. Tìm user (không phân biệt email tồn tại hay không để tránh user enumeration)
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    throw Object.assign(new Error("Email hoặc mật khẩu không đúng."), {
      status: 401,
    });
  }

  // 2. Kiểm tra tài khoản bị khoá
  if (!user.isActive) {
    throw Object.assign(
      new Error("Tài khoản đã bị khoá. Vui lòng liên hệ ban tổ chức."),
      { status: 403 },
    );
  }

  // 3. So sánh password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw Object.assign(new Error("Email hoặc mật khẩu không đúng."), {
      status: 401,
    });
  }

  // 4. Tạo token
  const tokenPayload: Omit<JwtPayload, "iat" | "exp"> = {
    sub: user.id,
    role: user.role as Role,
    email: user.email,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // 5. Lưu hash của refresh token vào Redis
  //    Lưu hash (không lưu plain) để giảm rủi ro nếu Redis bị dump
  const refreshHash = await bcrypt.hash(refreshToken, 8); // rounds thấp vì không lưu lâu
  await redis.set(
    refreshKey(user.id),
    refreshHash,
    "EX",
    REFRESH_TOKEN_TTL_SEC,
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  };
};

/**
 * Làm mới access token bằng refresh token.
 */
export const refreshAccessToken = async (refreshToken: string) => {
  // 1. Verify JWT (kiểm tra signature + expiry)
  let payload: JwtPayload;
  try {
    payload = jwt.verify(refreshToken, JWT_SECRET) as JwtPayload;
  } catch (err: any) {
    throw Object.assign(
      new Error("Refresh token không hợp lệ hoặc đã hết hạn."),
      { status: 401 },
    );
  }

  // 2. Kiểm tra hash trong Redis
  const storedHash = await redis.get(refreshKey(payload.sub));
  if (!storedHash) {
    throw Object.assign(
      new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."),
      { status: 401 },
    );
  }

  const isValid = await bcrypt.compare(refreshToken, storedHash);
  if (!isValid) {
    // Ai đó gửi refresh token không khớp → revoke ngay để bảo vệ
    await redis.del(refreshKey(payload.sub));
    throw Object.assign(
      new Error("Refresh token không hợp lệ. Vui lòng đăng nhập lại."),
      { status: 401 },
    );
  }

  // 3. Tạo access token mới
  const newAccessToken = generateAccessToken({
    sub: payload.sub,
    role: payload.role,
    email: payload.email,
  });

  return { accessToken: newAccessToken };
};

/**
 * Đăng xuất — revoke refresh token.
 */
export const logout = async (userId: string) => {
  await redis.del(refreshKey(userId));
};

/**
 * Lấy thông tin user hiện tại.
 */
export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      studentId: true,
      faculty: true,
      year: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw Object.assign(new Error("Người dùng không tồn tại."), {
      status: 404,
    });
  }

  return user;
};
