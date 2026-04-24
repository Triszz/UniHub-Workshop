import { Router } from "express";
import { verifyJWT } from "../../shared/middleware/auth";
import { loginRateLimit } from "../../shared/middleware/auth";
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  getMeHandler,
} from "./auth.controller";

export const authRouter = Router();

/**
 * POST /api/v1/auth/login
 * Public — có rate limit chống brute force (5 lần/phút/IP)
 */
authRouter.post("/login", loginRateLimit, loginHandler);

/**
 * POST /api/v1/auth/refresh
 * Public — client gửi refresh_token để nhận access_token mới
 */
authRouter.post("/refresh", refreshHandler);

/**
 * POST /api/v1/auth/logout
 * Protected — revoke refresh token trong Redis
 */
authRouter.post("/logout", verifyJWT, logoutHandler);

/**
 * GET /api/v1/auth/me
 * Protected — trả về thông tin user đang đăng nhập
 */
authRouter.get("/me", verifyJWT, getMeHandler);
