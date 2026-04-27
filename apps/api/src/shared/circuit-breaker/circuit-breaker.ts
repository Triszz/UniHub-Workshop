import { redis } from "../redis/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type CBState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CBConfig {
  name: string; // tên circuit (dùng làm Redis key)
  failureThreshold: number; // số lỗi liên tiếp để OPEN
  timeout: number; // ms ở trạng thái OPEN trước khi HALF_OPEN
}

interface CBRedisData {
  state: CBState;
  failureCount: number;
  openedAt: number; // timestamp ms, 0 nếu chưa OPEN
}

// ─── Redis key ────────────────────────────────────────────────────────────────

const cbKey = (name: string) => `circuit_breaker:${name}`;

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Omit<CBConfig, "name"> = {
  failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? "5"),
  timeout: parseInt(process.env.CB_TIMEOUT_MS ?? "30000"),
};

// ─── Read / Write state ───────────────────────────────────────────────────────

const getState = async (name: string): Promise<CBRedisData> => {
  const raw = await redis.get(cbKey(name));
  if (!raw) {
    return { state: "CLOSED", failureCount: 0, openedAt: 0 };
  }
  return JSON.parse(raw) as CBRedisData;
};

const saveState = async (name: string, data: CBRedisData): Promise<void> => {
  // Không set TTL — state cần persistent, tự reset qua logic
  await redis.set(cbKey(name), JSON.stringify(data));
};

// ─── Main: execute qua circuit breaker ───────────────────────────────────────

/**
 * Bọc một async function bằng Circuit Breaker.
 *
 * @example
 * const result = await circuitBreaker.execute(
 *   "payment_gateway",
 *   () => axios.post("http://localhost:3001/charge", payload)
 * );
 */
export const execute = async <T>(
  name: string,
  fn: () => Promise<T>,
  config: Partial<CBConfig> = {},
): Promise<T> => {
  const cfg: CBConfig = { name, ...DEFAULT_CONFIG, ...config };
  const data = await getState(name);
  const now = Date.now();

  // ── OPEN ───────────────────────────────────────────────────────────────────
  if (data.state === "OPEN") {
    const elapsed = now - data.openedAt;

    if (elapsed < cfg.timeout) {
      // Vẫn đang trong thời gian OPEN → fast fail
      const remainingSec = Math.ceil((cfg.timeout - elapsed) / 1000);
      const err = Object.assign(
        new Error("Dịch vụ thanh toán tạm thời không khả dụng."),
        {
          status: 503,
          code: "CIRCUIT_OPEN",
          retryAfter: remainingSec,
        },
      );
      throw err;
    }

    // Hết timeout → chuyển sang HALF_OPEN để probe
    console.log(`[CircuitBreaker:${name}] OPEN → HALF_OPEN (probing...)`);
    await saveState(name, { ...data, state: "HALF_OPEN" });
  }

  // ── CLOSED hoặc HALF_OPEN → thử gọi fn ────────────────────────────────────
  try {
    const result = await fn();

    // Thành công → reset về CLOSED
    if (data.state !== "CLOSED") {
      console.log(
        `[CircuitBreaker:${name}] ${data.state} → CLOSED (recovered)`,
      );
    }
    await saveState(name, { state: "CLOSED", failureCount: 0, openedAt: 0 });

    return result;
  } catch (err: any) {
    // Thất bại → tăng failure count

    // Nếu đang HALF_OPEN → probe thất bại → OPEN lại ngay
    if (data.state === "HALF_OPEN") {
      console.log(`[CircuitBreaker:${name}] HALF_OPEN → OPEN (probe failed)`);
      await saveState(name, {
        state: "OPEN",
        failureCount: data.failureCount + 1,
        openedAt: now,
      });
      throw err;
    }

    // CLOSED → tăng counter
    const newCount = data.failureCount + 1;

    if (newCount >= cfg.failureThreshold) {
      // Vượt ngưỡng → OPEN
      console.log(
        `[CircuitBreaker:${name}] CLOSED → OPEN ` +
          `(${newCount} failures >= threshold ${cfg.failureThreshold})`,
      );
      await saveState(name, {
        state: "OPEN",
        failureCount: newCount,
        openedAt: now,
      });
    } else {
      // Chưa đủ → vẫn CLOSED, ghi nhận failure
      console.log(
        `[CircuitBreaker:${name}] failure ${newCount}/${cfg.failureThreshold}`,
      );
      await saveState(name, {
        state: "CLOSED",
        failureCount: newCount,
        openedAt: 0,
      });
    }

    throw err;
  }
};

/**
 * Lấy trạng thái hiện tại của circuit — dùng cho health check / debug.
 */
export const getCircuitState = async (name: string): Promise<CBRedisData> =>
  getState(name);

/**
 * Reset circuit về CLOSED — dùng khi test hoặc manual recovery.
 */
export const resetCircuit = async (name: string): Promise<void> => {
  await saveState(name, { state: "CLOSED", failureCount: 0, openedAt: 0 });
  console.log(`[CircuitBreaker:${name}] Manually reset → CLOSED`);
};
