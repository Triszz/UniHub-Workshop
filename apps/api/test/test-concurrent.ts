// Test: 100 sinh viên đăng ký cùng lúc vào workshop 60 chỗ
// Chạy: npx ts-node test/test-concurrent.ts

import axios from "axios";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const BASE = "http://localhost:3000/api/v1";
const JWT_SECRET = process.env.JWT_SECRET!;
const prisma = new PrismaClient();

// Workshop ws-002: capacity = 60
const TARGET_WORKSHOP_ID = "ws-002";
const CONCURRENT_USERS = 100;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sinh JWT token trực tiếp — không cần gọi /auth/login.
 * Tránh hoàn toàn rate limit middleware.
 */
const generateToken = (userId: string, email: string, role: string): string =>
  jwt.sign({ sub: userId, email, role }, JWT_SECRET, { expiresIn: "1h" });

const register = async (
  token: string,
  workshopId: string,
): Promise<{ success: boolean; status: number; message: string }> => {
  try {
    await axios.post(
      `${BASE}/registrations`,
      { workshopId },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return { success: true, status: 201, message: "ok" };
  } catch (err: any) {
    return {
      success: false,
      status: err.response?.status ?? 0,
      message: err.response?.data?.error ?? err.message,
    };
  }
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Concurrent Registration Test");
  console.log(`  Workshop: ${TARGET_WORKSHOP_ID} (capacity = 60)`);
  console.log(`  Concurrent users: ${CONCURRENT_USERS}`);
  console.log("═══════════════════════════════════════════════════\n");

  // 1. Reset workshop về 0 để test sạch
  await prisma.registration.deleteMany({
    where: { workshopId: TARGET_WORKSHOP_ID },
  });
  await prisma.workshop.update({
    where: { id: TARGET_WORKSHOP_ID },
    data: { registeredCount: 0 },
  });
  console.log("🧹 Reset workshop registrations → 0\n");

  // 2. Lấy 100 sinh viên từ DB
  const students = await prisma.user.findMany({
    where: { role: "student" },
    take: CONCURRENT_USERS,
    select: { id: true, email: true, role: true },
  });

  if (students.length < CONCURRENT_USERS) {
    console.error(
      `❌ Chỉ có ${students.length} sinh viên trong DB. Cần ${CONCURRENT_USERS}.`,
    );
    console.error("   Chạy: npx ts-node seed/seed.ts");
    process.exit(1);
  }

  // 3. Sinh JWT token trực tiếp — không gọi login endpoint, tránh rate limit
  console.log(
    `⚡ Generating ${CONCURRENT_USERS} JWT tokens directly (no login endpoint)...`,
  );
  const tokens = students.map((s) => generateToken(s.id, s.email, s.role));
  console.log(`✅ Generated ${tokens.length} tokens\n`);

  // 4. Tất cả đăng ký CÙNG LÚC
  console.log("🚀 Firing all registrations simultaneously...");
  const startTime = Date.now();

  const results = await Promise.all(
    tokens.map((token) => register(token, TARGET_WORKSHOP_ID)),
  );

  const elapsed = Date.now() - startTime;

  // 5. Thống kê kết quả
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const failedByStatus = failed.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {} as Record<number, number>,
  );

  const sample409 = failed.find((r) => r.status === 409)?.message ?? "";

  console.log("\n─────────────────────────────────────────────────");
  console.log("  RESULTS");
  console.log("─────────────────────────────────────────────────");
  console.log(`  ✅ Successful (201):  ${successful.length}`);
  console.log(`  ❌ Failed:            ${failed.length}`);
  Object.entries(failedByStatus).forEach(([status, count]) => {
    console.log(`     • HTTP ${status}: ${count} requests`);
  });
  if (sample409) {
    console.log(`     Sample 409 msg: "${sample409}"`);
  }
  console.log(`\n  ⏱  Total time:       ${elapsed}ms`);
  console.log(
    `  ⚡  Avg per request:  ${(elapsed / CONCURRENT_USERS).toFixed(1)}ms`,
  );

  // 6. Verify DB
  const workshop = await prisma.workshop.findUnique({
    where: { id: TARGET_WORKSHOP_ID },
    select: { capacity: true, registeredCount: true },
  });

  const dbCount = workshop?.registeredCount ?? -1;
  const capacity = workshop?.capacity ?? 0;

  console.log("\n─────────────────────────────────────────────────");
  console.log("  DB VERIFICATION");
  console.log("─────────────────────────────────────────────────");
  console.log(`  Workshop capacity:       ${capacity}`);
  console.log(`  registeredCount in DB:   ${dbCount}`);
  console.log(`  Successful from test:    ${successful.length}`);

  const noOverbook = dbCount <= capacity;
  const isConsistent = dbCount === successful.length && noOverbook;

  if (isConsistent) {
    console.log("\n  ✅ PASS: No double-booking detected!");
    console.log(
      `          DB count (${dbCount}) === successful (${successful.length}) <= capacity (${capacity})`,
    );
  } else {
    console.log("\n  ❌ FAIL: Data inconsistency detected!");
    if (dbCount > capacity) {
      console.log(
        `          OVERBOOKING: registeredCount (${dbCount}) > capacity (${capacity})`,
      );
    }
    if (dbCount !== successful.length) {
      console.log(
        `          MISMATCH: registeredCount (${dbCount}) !== successful (${successful.length})`,
      );
    }
  }

  console.log("\n═══════════════════════════════════════════════════\n");
  process.exit(isConsistent ? 0 : 1);
}

main()
  .catch((err) => {
    console.error("Test runner error:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
