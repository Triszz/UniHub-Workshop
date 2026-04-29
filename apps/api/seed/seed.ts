import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dayAt = (offsetDays: number, hour: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  d.setMilliseconds(0);
  return d;
};

const generateQrCode = (
  registrationId: string,
  workshopId: string,
  userId: string,
  startsAt: Date,
): string => {
  const exp = Math.floor(startsAt.getTime() / 1000) + 2 * 60 * 60;
  return jwt.sign(
    { sub: registrationId, workshopId, userId, type: "workshop_qr", exp },
    process.env.JWT_SECRET ?? "dev-secret-change-in-production-32chars!!",
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding database...\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ROOMS — 3 phòng
  // ═══════════════════════════════════════════════════════════════════════════
  const rooms = await Promise.all([
    prisma.room.upsert({
      where: { id: "room-hall-a" },
      update: {},
      create: {
        id: "room-hall-a",
        name: "Hội trường A",
        building: "Tòa A",
        capacity: 200,
      },
    }),
    prisma.room.upsert({
      where: { id: "room-b401" },
      update: {},
      create: {
        id: "room-b401",
        name: "B4.01",
        building: "Tòa B",
        capacity: 80,
      },
    }),
    prisma.room.upsert({
      where: { id: "room-c201" },
      update: {},
      create: {
        id: "room-c201",
        name: "C2.01",
        building: "Tòa C",
        capacity: 60,
      },
    }),
  ]);
  console.log(`Rooms: ${rooms.length} records`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. USERS — 1 organizer + 3 staff + 100 students
  // ═══════════════════════════════════════════════════════════════════════════
  const [orgHash, staffHash, studentHash] = await Promise.all([
    bcrypt.hash("OrgAdmin2024!", 10),
    bcrypt.hash("Staff2024!", 10),
    bcrypt.hash("Password123!", 10),
  ]);

  const organizer = await prisma.user.upsert({
    where: { email: "organizer@university.edu.vn" },
    update: {},
    create: {
      email: "organizer@university.edu.vn",
      fullName: "Nguyễn Ban Tổ Chức",
      role: "organizer",
      passwordHash: orgHash,
    },
  });

  await Promise.all(
    [1, 2, 3].map((i) =>
      prisma.user.upsert({
        where: { email: `staff00${i}@university.edu.vn` },
        update: {},
        create: {
          email: `staff00${i}@university.edu.vn`,
          fullName: `Nhân viên Check-in 00${i}`,
          role: "checkin_staff",
          passwordHash: staffHash,
        },
      }),
    ),
  );

  const faculties = [
    "Công nghệ thông tin",
    "Kinh tế",
    "Kỹ thuật điện",
    "Ngoại ngữ",
  ];

  for (let i = 1; i <= 100; i++) {
    const num = String(i).padStart(3, "0");
    await prisma.user.upsert({
      where: { email: `student${num}@university.edu.vn` },
      update: {},
      create: {
        studentId: `SV2024${String(i).padStart(5, "0")}`,
        email: `student${num}@university.edu.vn`,
        fullName: `Sinh viên ${num}`,
        role: "student",
        faculty: faculties[(i - 1) % 4],
        year: ((i - 1) % 4) + 1,
        passwordHash: studentHash,
      },
    });
  }
  console.log(`Users: 1 organizer, 3 staff, 100 students`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. WORKSHOPS — 5 workshop (4 published, 1 draft)
  // ═══════════════════════════════════════════════════════════════════════════
  const workshopsData = [
    {
      id: "ws-001",
      title: "Kỹ năng phỏng vấn xin việc",
      description:
        "Workshop thực chiến giúp sinh viên chuẩn bị tốt nhất cho các buổi phỏng vấn.",
      speakerName: "TS. Lê Văn An",
      speakerBio: "10 năm kinh nghiệm tuyển dụng tại các tập đoàn đa quốc gia.",
      roomId: "room-hall-a",
      capacity: 150,
      startsAt: dayAt(1, 9),
      endsAt: dayAt(1, 11),
      price: 0,
      status: "published",
    },
    {
      id: "ws-002",
      title: "Xây dựng CV chuyên nghiệp",
      description: "Hướng dẫn thiết kế CV nổi bật theo chuẩn quốc tế ATS.",
      speakerName: "Nguyễn Thị Bình",
      speakerBio: "HR Manager tại ABC Corp với 8 năm kinh nghiệm.",
      roomId: "room-b401",
      capacity: 60,
      startsAt: dayAt(1, 14),
      endsAt: dayAt(1, 16),
      price: 0,
      status: "published",
    },
    {
      id: "ws-003",
      title: "Khởi nghiệp từ con số 0",
      description: "Chia sẻ hành trình từ ý tưởng đến startup triệu đô.",
      speakerName: "CEO Trần Minh Cường",
      speakerBio: "Founder & CEO của TechVN. Forbes 30 Under 30 Vietnam 2023.",
      roomId: "room-hall-a",
      capacity: 200,
      startsAt: dayAt(2, 9),
      endsAt: dayAt(2, 12),
      price: 50000,
      status: "published",
    },
    {
      id: "ws-004",
      title: "Kỹ năng thuyết trình & Public Speaking",
      description: "Luyện tập trình bày ý tưởng tự tin trước đám đông.",
      speakerName: "ThS. Phạm Thị Dung",
      speakerBio: "Giảng viên Kỹ năng mềm, Certified Trainer.",
      roomId: "room-c201",
      capacity: 40,
      startsAt: dayAt(3, 13),
      endsAt: dayAt(3, 15),
      price: 30000,
      status: "published",
    },
    {
      id: "ws-005",
      title: "Design Thinking (Sắp ra mắt)",
      description: "Nội dung đang được chuẩn bị.",
      roomId: "room-b401",
      capacity: 60,
      startsAt: dayAt(4, 9),
      endsAt: dayAt(4, 11),
      price: 0,
      status: "draft",
    },
  ] as const;

  for (const ws of workshopsData) {
    await prisma.workshop.upsert({
      where: { id: ws.id },
      update: { startsAt: ws.startsAt, endsAt: ws.endsAt },
      create: { ...ws, createdBy: organizer.id } as any,
    });
  }
  console.log(`Workshops: 4 published, 1 draft`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. REGISTRATIONS — 50 registrations
  //    - ws-001 (free):  30 sinh viên confirmed
  //    - ws-002 (free):  15 sinh viên confirmed
  //    - ws-003 (paid):   5 sinh viên confirmed (mock paid)
  // ═══════════════════════════════════════════════════════════════════════════

  // Reset registeredCount trước
  await prisma.workshop.updateMany({
    where: { id: { in: ["ws-001", "ws-002", "ws-003"] } },
    data: { registeredCount: 0 },
  });

  const students = await prisma.user.findMany({
    where: { role: "student" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const regPlan: Array<{
    studentIndex: number;
    workshopId: string;
    paid?: boolean;
  }> = [
    // ws-001: student 1–30
    ...Array.from({ length: 30 }, (_, i) => ({
      studentIndex: i,
      workshopId: "ws-001",
    })),
    // ws-002: student 31–45
    ...Array.from({ length: 15 }, (_, i) => ({
      studentIndex: 30 + i,
      workshopId: "ws-002",
    })),
    // ws-003: student 46–50 (paid)
    ...Array.from({ length: 5 }, (_, i) => ({
      studentIndex: 45 + i,
      workshopId: "ws-003",
      paid: true,
    })),
  ];

  const registrations: Array<{
    id: string;
    userId: string;
    workshopId: string;
  }> = [];

  for (const plan of regPlan) {
    const student = students[plan.studentIndex];
    const workshop = workshopsData.find((w) => w.id === plan.workshopId)!;

    const existing = await prisma.registration.findUnique({
      where: {
        userId_workshopId: { userId: student.id, workshopId: plan.workshopId },
      },
    });
    if (existing) {
      registrations.push({
        id: existing.id,
        userId: student.id,
        workshopId: plan.workshopId,
      });
      continue;
    }

    // Tạo payment record cho workshop có phí
    let paymentId: string | undefined;
    if (plan.paid) {
      const payment = await prisma.payment.create({
        data: {
          idempotencyKey: `seed-payment-${student.id}-${plan.workshopId}`,
          amount: workshop.price,
          status: "completed",
          gatewayRef: `GW-SEED-${student.id.slice(0, 8).toUpperCase()}`,
        },
      });
      paymentId = payment.id;
    }

    // Sinh QR code
    const tempId = `temp-${student.id}-${plan.workshopId}`;
    const reg = await prisma.registration.create({
      data: {
        userId: student.id,
        workshopId: plan.workshopId,
        status: "confirmed",
        ...(paymentId && { paymentId }),
      },
    });

    const qrCode = generateQrCode(
      reg.id,
      plan.workshopId,
      student.id,
      new Date(workshop.startsAt),
    );
    await prisma.registration.update({
      where: { id: reg.id },
      data: { qrCode },
    });

    // Tăng registeredCount
    await prisma.workshop.update({
      where: { id: plan.workshopId },
      data: { registeredCount: { increment: 1 } },
    });

    registrations.push({
      id: reg.id,
      userId: student.id,
      workshopId: plan.workshopId,
    });
  }
  console.log(`✅ Registrations: ${registrations.length} records (30+15+5)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CHECKINS — 20 check-ins từ ws-001
  //    (20 trong số 30 sinh viên đã đăng ký ws-001)
  // ═══════════════════════════════════════════════════════════════════════════
  const ws001Regs = registrations
    .filter((r) => r.workshopId === "ws-001")
    .slice(0, 20);

  let checkinCount = 0;
  for (const reg of ws001Regs) {
    const existing = await prisma.checkin.findUnique({
      where: { registrationId: reg.id },
    });
    if (existing) {
      checkinCount++;
      continue;
    }

    const checkedInAt = new Date(workshopsData[0].startsAt);
    checkedInAt.setMinutes(checkedInAt.getMinutes() + checkinCount * 2); // 2 phút cách nhau

    await prisma.$transaction([
      prisma.checkin.create({
        data: {
          registrationId: reg.id,
          checkedInAt,
          syncedAt: checkedInAt,
          deviceId: `seed-device-${(checkinCount % 3) + 1}`,
          isOffline: checkinCount >= 15, // 5 cái cuối là offline sync
        },
      }),
      prisma.registration.update({
        where: { id: reg.id },
        data: { status: "checked_in" },
      }),
    ]);
    checkinCount++;
  }
  console.log(
    `Checkins: ${checkinCount} records (15 online + 5 offline-synced)`,
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CSV SAMPLE FILE — data/students.csv
  // ═══════════════════════════════════════════════════════════════════════════
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const csvLines = ["student_id,full_name,email,faculty,year"];
  for (let i = 1; i <= 100; i++) {
    const num = String(i).padStart(3, "0");
    csvLines.push(
      `SV2024${String(i).padStart(5, "0")},Sinh viên ${num},student${num}@university.edu.vn,${faculties[(i - 1) % 4]},${((i - 1) % 4) + 1}`,
    );
  }
  // Thêm 5 sinh viên mới (chưa có trong DB) để test import
  for (let i = 101; i <= 105; i++) {
    const num = String(i).padStart(3, "0");
    csvLines.push(
      `SV2024${String(i).padStart(5, "0")},Sinh viên Mới ${num},student${num}@university.edu.vn,${faculties[(i - 1) % 4]},${((i - 1) % 4) + 1}`,
    );
  }
  // Thêm 2 dòng lỗi để test error handling
  csvLines.push("INVALID_ID,Sinh viên Lỗi,not-an-email,CNTT,99");
  csvLines.push(",Thiếu ID,,Kinh tế,2");

  fs.writeFileSync(
    path.join(dataDir, "students.csv"),
    csvLines.join("\n"),
    "utf8",
  );
  console.log(`CSV: data/students.csv (100 existing + 5 new + 2 invalid rows)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const [totalUsers, totalWorkshops, totalRegs, totalCheckins] =
    await Promise.all([
      prisma.user.count(),
      prisma.workshop.count(),
      prisma.registration.count(),
      prisma.checkin.count(),
    ]);

  console.log("\n─────────────────────────────────────────");
  console.log("Database summary:");
  console.log(`   Users:         ${totalUsers}`);
  console.log(`   Workshops:     ${totalWorkshops}`);
  console.log(`   Registrations: ${totalRegs}`);
  console.log(`   Checkins:      ${totalCheckins}`);
  console.log("─────────────────────────────────────────");
  console.log("\nSeed hoàn tất!\n");
  console.log("Tài khoản test:");
  console.log("  Organizer  : organizer@university.edu.vn  / OrgAdmin2024!");
  console.log("  Student    : student001@university.edu.vn / Password123!");
  console.log("  Staff      : staff001@university.edu.vn   / Staff2024!");
  console.log("─────────────────────────────────────────\n");
}

main()
  .catch((err) => {
    console.error("\nSeed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
