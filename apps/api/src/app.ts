import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import { healthRouter } from "./modules/health/health.routes";
import { authRouter } from "./modules/auth/auth.routes";
import {
  workshopPublicRouter,
  workshopAdminRouter,
} from "./modules/workshop/workshop.routes";
import { registrationRouter } from "./modules/registration/registration.routes";
import {
  paymentRouter,
  circuitBreakerAdminRouter,
} from "./modules/payment/payment.routes";
import { errorHandler } from "./shared/middleware/errorHandler";
import { notFound } from "./shared/middleware/notFound";
import { setupCsvImportCron } from "./workers/csv-import.worker";
import { csvImportAdminRouter } from "./modules/admin/csv-import.routes";
import { notificationRouter } from "./modules/notification/notification.routes";
import { setupNotificationCron } from "./workers/notification.worker";

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
app.use("/api/v1/workshops", workshopPublicRouter);
app.use("/api/v1/admin/workshops", workshopAdminRouter);
app.use("/api/v1/admin/csv-imports", csvImportAdminRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/registrations", registrationRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/admin/circuit-breaker", circuitBreakerAdminRouter);

// ─── Error handling ─────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, HOST, async () => {
  console.log(`API Server running on http://localhost:${PORT}`);
  await setupCsvImportCron();
  await setupNotificationCron();
});

export default app;
