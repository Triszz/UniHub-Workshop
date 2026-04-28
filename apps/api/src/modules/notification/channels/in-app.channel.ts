import { NotificationChannel, NotificationPayload } from './channel.interface';
import { prisma } from '../../../shared/database/prisma';

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
