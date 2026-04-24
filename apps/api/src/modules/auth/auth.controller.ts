import { Request, Response, NextFunction } from "express";
import * as AuthService from "./auth.service";

// ─── POST /auth/login ─────────────────────────────────────────────────────────

export const loginHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;

    // Validate input cơ bản (middleware validate sẽ chặn trước controller,
    // nhưng giữ lại đây như lớp bảo vệ thứ hai)
    if (!email || !password) {
      res.status(400).json({ error: "Email và mật khẩu là bắt buộc." });
      return;
    }

    const result = await AuthService.login(
      email.trim().toLowerCase(),
      password,
    );

    res.status(200).json({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

export const refreshHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: "refresh_token là bắt buộc." });
      return;
    }

    const result = await AuthService.refreshAccessToken(refresh_token);

    res.status(200).json({ access_token: result.accessToken });
  } catch (err) {
    next(err);
  }
};

// ─── POST /auth/logout ────────────────────────────────────────────────────────

export const logoutHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // req.user được gắn bởi verifyJWT middleware
    await AuthService.logout(req.user!.id);
    res.status(200).json({ message: "Đăng xuất thành công." });
  } catch (err) {
    next(err);
  }
};

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

export const getMeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await AuthService.getMe(req.user!.id);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};
