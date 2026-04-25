import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...\n");

  // ═══════════════════════════════════════════════════════
  // 1. ROOMS (3 phòng)
  // ═══════════════════════════════════════════════════════
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
  rooms.forEach((r) =>
    console.log(`   • ${r.name} (${r.building}) — sức chứa ${r.capacity}`),
  );

  // ═══════════════════════════════════════════════════════
  // 2. USERS
  // ═══════════════════════════════════════════════════════
  const [orgHash, staffHash, studentHash] = await Promise.all([
    bcrypt.hash("OrgAdmin2024!", 12),
    bcrypt.hash("Staff2024!", 12),
    bcrypt.hash("Password123!", 12),
  ]);

  // Organizer
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

  // Check-in staff (3 người)
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

  // Students (100 sinh viên)
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

  // ═══════════════════════════════════════════════════════
  // 3. WORKSHOPS (5 workshop)
  // ═══════════════════════════════════════════════════════

  // Helper: tạo Date offset từ ngày hiện tại
  const dayAt = (offsetDays: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, 0, 0, 0);
    d.setMilliseconds(0);
    return d;
  };

  const workshopsData = [
    // ── Workshop 1: free, hội trường lớn ─────────────────
    {
      id: "ws-001",
      title: "Kỹ năng phỏng vấn xin việc",
      description:
        "Workshop thực chiến giúp sinh viên chuẩn bị tốt nhất cho các buổi phỏng vấn tại doanh nghiệp lớn. Bao gồm: cách trả lời câu hỏi hành vi (STAR method), ngôn ngữ cơ thể, và luyện tập mock interview.",
      speakerName: "TS. Lê Văn An",
      speakerBio:
        "Tiến sĩ Quản trị nhân sự, 10 năm kinh nghiệm tuyển dụng tại các tập đoàn đa quốc gia. Cựu HR Director tại FPT Software.",
      roomId: "room-hall-a",
      capacity: 150,
      startsAt: dayAt(1, 9),
      endsAt: dayAt(1, 11),
      price: 0,
      status: "published",
      createdBy: organizer.id,
    },
    // ── Workshop 2: free, phòng nhỏ ──────────────────────
    {
      id: "ws-002",
      title: "Xây dựng CV chuyên nghiệp",
      description:
        "Hướng dẫn thiết kế CV nổi bật theo chuẩn quốc tế ATS (Applicant Tracking System). Thực hành trực tiếp với template và nhận feedback ngay tại workshop.",
      speakerName: "Nguyễn Thị Bình",
      speakerBio:
        "HR Manager tại ABC Corp với 8 năm kinh nghiệm. Đã đọc hơn 10.000 CV và tuyển dụng cho 200+ vị trí.",
      roomId: "room-b401",
      capacity: 60,
      startsAt: dayAt(1, 14),
      endsAt: dayAt(1, 16),
      price: 0,
      status: "published",
      createdBy: organizer.id,
    },
    // ── Workshop 3: có phí, hội trường lớn ───────────────
    {
      id: "ws-003",
      title: "Khởi nghiệp từ con số 0",
      description:
        "Chia sẻ hành trình từ ý tưởng đến startup triệu đô. Học cách validate ý tưởng, xây dựng MVP, gọi vốn và scale. Bao gồm Q&A trực tiếp với founder.",
      speakerName: "CEO Trần Minh Cường",
      speakerBio:
        "Founder & CEO của TechVN — startup SaaS với 500.000+ users. Forbes 30 Under 30 Vietnam 2023.",
      roomId: "room-hall-a",
      capacity: 200,
      startsAt: dayAt(2, 9),
      endsAt: dayAt(2, 12),
      price: 50000,
      status: "published",
      createdBy: organizer.id,
    },
    // ── Workshop 4: có phí, phòng vừa ────────────────────
    {
      id: "ws-004",
      title: "Kỹ năng thuyết trình & Public Speaking",
      description:
        "Luyện tập trình bày ý tưởng tự tin trước đám đông. Kỹ thuật kiểm soát lo lắng, cấu trúc bài nói, sử dụng ngôn ngữ cơ thể và giọng điệu hiệu quả.",
      speakerName: "ThS. Phạm Thị Dung",
      speakerBio:
        "Giảng viên Kỹ năng mềm, Certified Trainer. Đã đào tạo 5.000+ sinh viên và nhân viên doanh nghiệp.",
      roomId: "room-c201",
      capacity: 40,
      startsAt: dayAt(3, 13),
      endsAt: dayAt(3, 15),
      price: 30000,
      status: "published",
      createdBy: organizer.id,
    },
    // ── Workshop 5: draft — sinh viên không thấy ─────────
    {
      id: "ws-005",
      title: "Thiết kế tư duy sáng tạo (Design Thinking)",
      description: "Nội dung đang được chuẩn bị.",
      speakerName: "Diễn giả chưa xác định",
      roomId: "room-b401",
      capacity: 60,
      startsAt: dayAt(4, 9),
      endsAt: dayAt(4, 11),
      price: 0,
      status: "draft",
      createdBy: organizer.id,
    },
  ] as const;

  for (const ws of workshopsData) {
    await prisma.workshop.upsert({
      where: { id: ws.id },
      update: {
        startsAt: ws.startsAt,
        endsAt: ws.endsAt,
      },
      create: ws as any,
    });
  }
  console.log(`Workshops: 4 published, 1 draft`);
  workshopsData.forEach((w) =>
    console.log(
      `   • [${w.status.toUpperCase()}] ${w.title} — ${w.price === 0 ? "Miễn phí" : `${w.price.toLocaleString()}đ`}`,
    ),
  );

  // ═══════════════════════════════════════════════════════
  // 4. SAMPLE REGISTRATIONS (ws-001, 20 sinh viên đầu)
  // ═══════════════════════════════════════════════════════
  const students = await prisma.user.findMany({
    where: { role: "student" },
    take: 20,
    orderBy: { createdAt: "asc" },
  });

  let regCount = 0;
  for (const student of students) {
    const existing = await prisma.registration.findUnique({
      where: {
        userId_workshopId: { userId: student.id, workshopId: "ws-001" },
      },
    });
    if (existing) continue;

    const qrCode = `QR-SEED-${student.id}-ws-001`;

    await prisma.$transaction([
      prisma.registration.create({
        data: {
          userId: student.id,
          workshopId: "ws-001",
          status: "confirmed",
          qrCode,
        },
      }),
      prisma.workshop.update({
        where: { id: "ws-001" },
        data: { registeredCount: { increment: 1 } },
      }),
    ]);
    regCount++;
  }
  console.log(`Registrations: ${regCount} mẫu cho ws-001`);

  // ═══════════════════════════════════════════════════════
  // 5. SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log("\nSeed hoàn tất!\n");
  console.log("─────────────────────────────────────────");
  console.log("Tài khoản test:");
  console.log("  Organizer  : organizer@university.edu.vn  / OrgAdmin2024!");
  console.log("  Student    : student001@university.edu.vn / Password123!");
  console.log("  Staff      : staff001@university.edu.vn   / Staff2024!");
  console.log("─────────────────────────────────────────");
}

main()
  .catch((err) => {
    console.error("\nSeed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
