import { PrismaClient } from '@prisma/client';
import { notificationService } from './src/modules/notification/notification.service';
import { notificationQueue } from './src/workers/notification.worker';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No user found in DB");
    return;
  }

  console.log(`Found user: ${user.email} (ID: ${user.id})`);

  console.log("Enqueuing notification job...");
  await notificationQueue.add(
    "send-notification",
    {
      type: "registration_confirmed",
      userId: user.id,
      payload: {
        workshopTitle: "Lập trình React Native cơ bản",
        startsAt: "2026-05-01 08:00:00"
      }
    },
    { 
      attempts: 3, 
      backoff: { type: "exponential", delay: 60000 },
      removeOnComplete: true
    }
  );
  
  console.log("Job enqueued.");
  
  // Wait a bit to let worker process
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  
  console.log("Latest notification in DB:", notifications);
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
    process.exit(0);
  });
