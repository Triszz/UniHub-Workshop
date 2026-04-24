import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log("Seeding database...");

  // ─── Rooms ──────────────────────────────────────────────────────────────────
  const rooms = await Promise.all([
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

  // ─── Users ───────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Password123!", SALT_ROUNDS);
  const orgHash = await bcrypt.hash("OrgAdmin2024!", SALT_ROUNDS);
  const staffHash = await bcrypt.hash("Staff2024!", SALT_ROUNDS);

  // Organizers
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

  // Check-in staff
  const staffAccounts = await Promise.all(
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
  const studentData = Array.from({ length: 100 }, (_, i) => {
    const num = String(i + 1).padStart(3, "0");
    return {
      email: `student${num}@university.edu.vn`,
      fullName: `Sinh viên ${num}`,
      studentId: `SV2024${num.padStart(5, "0")}`,
      role: "student" as const,
      faculty: ["Công nghệ thông tin", "Kinh tế", "Kỹ thuật", "Ngoại ngữ"][
        i % 4
      ],
      year: (i % 4) + 1,
      passwordHash,
    };
  });

  let studentCount = 0;
  for (const s of studentData) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: s,
    });
    studentCount++;
  }

  console.log(
    `Users: 1 organizer, ${staffAccounts.length} staff, ${studentCount} students`,
  );

  // ─── Workshops ───────────────────────────────────────────────────────────────
  const now = new Date();
  const day = (offset: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  const workshops = await Promise.all([
    prisma.workshop.upsert({
      where: { id: "ws-001" },
      update: {},
      create: {
        id: "ws-001",
        title: "Kỹ năng phỏng vấn xin việc",
        description:
          "Workshop giúp sinh viên chuẩn bị kỹ năng phỏng vấn tại các công ty lớn.",
        speakerName: "TS. Lê Văn A",
        speakerBio:
          "10 năm kinh nghiệm tuyển dụng tại các tập đoàn đa quốc gia.",
        roomId: "room-hall-a",
        capacity: 150,
        startsAt: day(1, 9),
        endsAt: day(1, 11),
        price: 0,
        status: "published",
        createdBy: organizer.id,
      },
    }),
    prisma.workshop.upsert({
      where: { id: "ws-002" },
      update: {},
      create: {
        id: "ws-002",
        title: "Xây dựng CV chuyên nghiệp",
        description: "Hướng dẫn thiết kế CV nổi bật theo chuẩn quốc tế.",
        speakerName: "Nguyễn Thị B",
        speakerBio: "HR Manager tại ABC Corp.",
        roomId: "room-b401",
        capacity: 60,
        startsAt: day(1, 14),
        endsAt: day(1, 16),
        price: 0,
        status: "published",
        createdBy: organizer.id,
      },
    }),
    prisma.workshop.upsert({
      where: { id: "ws-003" },
      update: {},
      create: {
        id: "ws-003",
        title: "Khởi nghiệp từ con số 0",
        description:
          "Chia sẻ hành trình và bài học thực chiến từ startup thành công.",
        speakerName: "CEO Trần C",
        speakerBio: "Founder & CEO của startup triệu đô.",
        roomId: "room-hall-a",
        capacity: 200,
        startsAt: day(2, 9),
        endsAt: day(2, 12),
        price: 50000, // 50,000 VND
        status: "published",
        createdBy: organizer.id,
      },
    }),
    prisma.workshop.upsert({
      where: { id: "ws-004" },
      update: {},
      create: {
        id: "ws-004",
        title: "Kỹ năng thuyết trình",
        description:
          "Luyện tập public speaking và trình bày ý tưởng thuyết phục.",
        speakerName: "ThS. Phạm D",
        roomId: "room-c201",
        capacity: 40,
        startsAt: day(3, 13),
        endsAt: day(3, 15),
        price: 30000,
        status: "published",
        createdBy: organizer.id,
      },
    }),
    prisma.workshop.upsert({
      where: { id: "ws-005" },
      update: {},
      create: {
        id: "ws-005",
        title: "Workshop chưa công bố",
        description: "Nội dung đang được chuẩn bị.",
        roomId: "room-b401",
        capacity: 60,
        startsAt: day(4, 9),
        endsAt: day(4, 11),
        price: 0,
        status: "draft", // sinh viên không thấy cái này
        createdBy: organizer.id,
      },
    }),
  ]);
  console.log(`Workshops: ${workshops.length} records (4 published, 1 draft)`);

  // ─── Sample registrations (ws-001 — free, 20 sinh viên) ──────────────────────
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

    // Sinh QR token đơn giản (production dùng jwt.sign)
    const qrCode = `QR-${student.id}-ws-001-${Date.now()}`;

    await prisma.registration.create({
      data: {
        userId: student.id,
        workshopId: "ws-001",
        status: "confirmed",
        qrCode,
      },
    });

    // Cập nhật registeredCount
    await prisma.workshop.update({
      where: { id: "ws-001" },
      data: { registeredCount: { increment: 1 } },
    });

    regCount++;
  }
  console.log(`Registrations: ${regCount} mẫu cho ws-001`);

  // ─── CSV sample file content (in ra để copy) ─────────────────────────────────
  console.log("\nSample students.csv (lưu vào data/students.csv):");
  console.log("student_id,full_name,email,faculty,year");
  studentData.slice(0, 5).forEach((s) => {
    console.log(
      `${s.studentId},${s.fullName},${s.email},${s.faculty},${s.year}`,
    );
  });
  console.log("...");

  console.log("\nSeed complete!\n");
  console.log("Tài khoản test:");
  console.log("  Organizer : organizer@university.edu.vn / OrgAdmin2024!");
  console.log("  Student   : student001@university.edu.vn / Password123!");
  console.log("  Staff     : staff001@university.edu.vn / Staff2024!");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
