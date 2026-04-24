import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import { healthRouter } from "./modules/health/health.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { errorHandler } from "./shared/middleware/errorHandler";
import { notFound } from "./shared/middleware/notFound";

const app = express();
const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ─── Global middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/v1", healthRouter);
app.use("/api/v1/auth", authRouter);

// ─── Error handling ─────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, HOST, () => {
  console.log(`API Server running on http://localhost:${PORT}`);
});

export default app;
