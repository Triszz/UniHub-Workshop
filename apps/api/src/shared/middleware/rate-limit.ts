import { Request, Response, NextFunction } from "express";
import { redis } from "../redis/client";

// ─── Lua script inline — tránh vấn đề __dirname khi chạy ts-node ─────────────
const TOKEN_BUCKET_LUA = `
local key         = KEYS[1]
local capacity    = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now_ms      = tonumber(ARGV[3])

local bucket      = redis.call('HMGET', key, 'tokens', 'last_refill_ms')
local tokens      = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil or last_refill == nil then
  tokens     = capacity
  last_refill = now_ms
end

local elapsed_sec = (now_ms - last_refill) / 1000.0
local refilled    = elapsed_sec * refill_rate
tokens = math.min(capacity, tokens + refilled)
last_refill = now_ms

if tokens < 1 then
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill_ms', last_refill)
  redis.call('EXPIRE', key, 60)
  return 0
end

tokens = tokens - 1
redis.call('HMSET', key, 'tokens', tokens, 'last_refill_ms', last_refill)
redis.call('EXPIRE', key, 60)
return 1
`;

// Đăng ký lệnh một lần ở module level
(redis as any).defineCommand("tokenBucket", {
  numberOfKeys: 1,
  lua: TOKEN_BUCKET_LUA,
});

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_CAPACITY = parseInt(process.env.RATE_LIMIT_CAPACITY ?? "10");
const DEFAULT_REFILL_RATE = parseFloat(
  process.env.RATE_LIMIT_REFILL_RATE ?? "2",
);

interface RateLimitOptions {
  capacity?: number;
  refillRate?: number;
  keyPrefix?: string;
}

export const tokenBucketLimit = (options: RateLimitOptions = {}) => {
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  const refillRate = options.refillRate ?? DEFAULT_REFILL_RATE;
  const keyPrefix = options.keyPrefix ?? "rate_limit";

  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.user?.id ?? req.ip ?? "anonymous";
    const bucketKey = `${keyPrefix}:${identifier}`;

    try {
      const result: number = await (redis as any).tokenBucket(
        bucketKey,
        String(capacity),
        String(refillRate),
        String(Date.now()),
      );

      if (result === 1) {
        next();
        return;
      }

      const retryAfterSec = Math.ceil(1 / refillRate);

      res.set("Retry-After", String(retryAfterSec));
      res.set("X-RateLimit-Limit", String(capacity));
      res.set("X-RateLimit-Remaining", "0");

      res.status(429).json({
        error: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfterSec} giây.`,
        retryAfter: retryAfterSec,
        code: "RATE_LIMIT_EXCEEDED",
      });
    } catch (redisErr) {
      console.error("[RateLimit] Redis error, failing open:", redisErr);
      next();
    }
  };
};
