import { PrismaClient } from '@prisma/client';
import { updateWorkshop, cancelWorkshop } from './src/modules/workshop/workshop.service';
import { notificationQueue } from './src/workers/notification.worker';

const prisma = new PrismaClient();

async function main() {
  console.log("=== BẮT ĐẦU TEST NOTIFICATION ===");

  // 1. Tạo dữ liệu giả lập (User, Room)
  let user = await prisma.user.findFirst({ where: { email: 'test_noti@unihub.edu.vn' }});
  if (!user) {
    user = await prisma.user.create({
      data: {
        studentId: 'SV99999999',
        email: 'test_noti@unihub.edu.vn', // Thay bằng email thật trên Mailtrap nếu muốn
        fullName: 'Test Notification User',
        role: 'student',
      }
    });
  }

  let room = await prisma.room.findFirst();
  if (!room) {
    room = await prisma.room.create({
      data: { name: 'Phòng 101', capacity: 50 }
    });
  }

  // 2. Tạo Workshop bắt đầu trong 23.5 giờ (Để lát test Cron)
  const startsAt = new Date(Date.now() + 23.5 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  
  const workshop = await prisma.workshop.create({
    data: {
      title: 'Workshop Test Notification',
      roomId: room.id,
      capacity: 50,
      startsAt,
      endsAt,
      status: 'published',
      isReminderSent: false,
    }
  });
  console.log(`[1] Đã tạo Workshop: ${workshop.title} (ID: ${workshop.id})`);

  // 3. Đăng ký cho User
  const registration = await prisma.registration.create({
    data: {
      userId: user.id,
      workshopId: workshop.id,
      status: 'confirmed',
    }
  });
  console.log(`[2] Đã tạo Registration (Confirmed) cho user ${user.email}`);

  // 4. TEST 1: Đổi giờ Workshop -> Gửi workshop_updated
  console.log("\n>>> Đang test: Đổi giờ workshop...");
  const newStartsAt = new Date(startsAt.getTime() + 15 * 60 * 1000); // Lùi lịch 15p
  const newEndsAt = new Date(endsAt.getTime() + 15 * 60 * 1000);
  
  await updateWorkshop(workshop.id, { startsAt: newStartsAt.toISOString(), endsAt: newEndsAt.toISOString() });
  console.log("[3] Đã đổi giờ workshop. Hãy kiểm tra In-app DB và Mailtrap!");

  // Chờ 2 giây để worker kịp xử lý job
  await new Promise(r => setTimeout(r, 2000));

  // 5. TEST 2: Trigger Cronjob Reminder
  console.log("\n>>> Đang test: Chạy Cron job (Quét reminder)...");
  await notificationQueue.add(
    "check-reminders-job",
    { type: "cron_check_reminders" }
  );
  console.log("[4] Đã đẩy job quét Cron. Do Workshop này diễn ra trong <24h nên sẽ có email nhắc nhở.");

  // Chờ 2 giây
  await new Promise(r => setTimeout(r, 2000));

  // 6. TEST 3: Huỷ Workshop -> Gửi workshop_cancelled
  console.log("\n>>> Đang test: Huỷ workshop...");
  await cancelWorkshop(workshop.id);
  console.log("[5] Đã huỷ workshop. Học viên sẽ nhận được email huỷ.");

  console.log("\n=== TEST HOÀN TẤT. BẠN HÃY KIỂM TRA MAILTRAP VÀ BẢNG NOTIFICATIONS ===");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
