import { NotificationChannel, NotificationPayload } from './channel.interface';
import { prisma } from '../../../shared/database/prisma';

const isSamePayload = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

export class InAppChannel implements NotificationChannel {
  name = 'in_app';

  async send(notification: NotificationPayload): Promise<void> {
    const { userId, type, payload } = notification;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.warn(`[InAppChannel] User ${userId} not found, skip sending.`);
      return;
    }

    try {
      const recentNotifications = await prisma.notification.findMany({
        where: {
          userId,
          type,
          channel: this.name,
          status: { in: ['pending', 'sent', 'read'] },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { payload: true },
      });

      if (recentNotifications.some((item) => isSamePayload(item.payload, payload))) {
        console.log(`[InAppChannel] Duplicate in-app notification skipped for user ${userId} (type: ${type})`);
        return;
      }

      await prisma.notification.create({
        data: {
          userId,
          type,
          channel: this.name,
          payload,
          status: 'sent',
          sentAt: new Date(),
        },
      });

      console.log(`[InAppChannel] Saved in-app notification for user ${userId} (type: ${type})`);
    } catch (error: any) {
      console.error(`[InAppChannel] Error saving notification for user ${userId}:`, error.message);
      throw error;
    }
  }
}
