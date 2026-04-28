// Mock Payment Gateway — chạy riêng trên port 3001
// Chạy: npx ts-node src/mock-gateway/mock-gateway.ts
//
// Config qua env:
//   MOCK_GATEWAY_DELAY_MS=500      độ trễ giả (ms)
//   MOCK_GATEWAY_ERROR_RATE=0.0    tỷ lệ lỗi 0.0–1.0
//   MOCK_GATEWAY_TIMEOUT_RATE=0.0  tỷ lệ timeout 0.0–1.0

import express, { Request, Response } from "express";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = 3001;

app.use(express.json());

// ─── Runtime config (có thể đổi qua PATCH /admin/config khi test) ────────────

let config = {
  delayMs: parseInt(process.env.MOCK_GATEWAY_DELAY_MS ?? "500"),
  errorRate: parseFloat(process.env.MOCK_GATEWAY_ERROR_RATE ?? "0.0"),
  timeoutRate: parseFloat(process.env.MOCK_GATEWAY_TIMEOUT_RATE ?? "0.0"),
};

// ─── Helper ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── POST /charge ─────────────────────────────────────────────────────────────

app.post("/charge", async (req: Request, res: Response) => {
  const { amount, idempotencyKey } = req.body;

  if (!amount || !idempotencyKey) {
    res.status(400).json({ error: "amount và idempotencyKey là bắt buộc." });
    return;
  }

  // Simulate timeout — treo 30s, API caller sẽ timeout trước
  if (Math.random() < config.timeoutRate) {
    console.log(`[Gateway] TIMEOUT  key=${idempotencyKey}`);
    await sleep(30_000);
    return;
  }

  // Simulate delay
  if (config.delayMs > 0) await sleep(config.delayMs);

  // Simulate error
  if (Math.random() < config.errorRate) {
    console.log(`[Gateway] ERROR    key=${idempotencyKey}`);
    res.status(502).json({ error: "Payment processor unavailable." });
    return;
  }

  // Success
  const gatewayRef = `GW-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  console.log(
    `[Gateway] SUCCESS  key=${idempotencyKey}  ref=${gatewayRef}  amount=${amount}`,
  );

  res.status(200).json({
    success: true,
    gatewayRef,
    amount,
    processedAt: new Date().toISOString(),
  });
});

// ─── PATCH /admin/config — đổi config lúc runtime ────────────────────────────

app.patch("/admin/config", (req: Request, res: Response) => {
  const { delayMs, errorRate, timeoutRate } = req.body;
  if (delayMs !== undefined) config.delayMs = delayMs;
  if (errorRate !== undefined) config.errorRate = errorRate;
  if (timeoutRate !== undefined) config.timeoutRate = timeoutRate;
  console.log(`[Gateway] Config updated:`, config);
  res.json({ config });
});

app.get("/health", (_req, res) => res.json({ status: "ok", config }));

app.listen(PORT, () => {
  console.log(`Mock Payment Gateway running on http://localhost:${PORT}`);
  console.log(
    `   PATCH /admin/config { "errorRate": 1.0 }  → test circuit breaker`,
  );
  console.log(`   PATCH /admin/config { "errorRate": 0.0 }  → bình thường`);
});
