import { NotificationChannel, NotificationPayload } from './channels/channel.interface';
import { EmailChannel } from './channels/email.channel';
import { InAppChannel } from './channels/in-app.channel';
import { prisma } from '../../shared/database/prisma';

export class NotificationService {
  private channels: Map<string, NotificationChannel> = new Map();

  constructor() {
    // Đăng ký các channel
    this.registerChannel(new EmailChannel());
    this.registerChannel(new InAppChannel());
  }

  registerChannel(channel: NotificationChannel) {
    this.channels.set(channel.name, channel);
  }

  /**
   * Theo yêu cầu từ specs:
   * Registration -> email + in_app
   * Payment -> email + in_app
   * ...
   * Tạm thời chúng ta luôn gửi qua cả email và in_app
   */
  async getActiveChannelsForUser(userId: string, type: string): Promise<string[]> {
    // Tương lai có thể kiểm tra preferences của user
    if (type === 'registration_lifecycle') {
      return ['in_app'];
    }

    return ['email', 'in_app'];
  }

  async dispatch(type: string, userId: string, payload: Record<string, any>) {
    const activeChannels = await this.getActiveChannelsForUser(userId, type);
    
    const notification: NotificationPayload = {
      type,
      userId,
      payload,
    };

    // Gửi song song qua tất cả kênh active
    const results = await Promise.allSettled(
      activeChannels.map(async (chName) => {
        const channel = this.channels.get(chName);
        if (!channel) {
          console.warn(`[NotificationService] Channel ${chName} not registered`);
          return;
        }

        try {
          await channel.send(notification);
        } catch (error: any) {
          // Lưu trạng thái lỗi vào db cho kênh tương ứng
          await prisma.notification.create({
            data: {
              userId,
              type,
              channel: chName,
              payload,
              status: 'failed',
            },
          });
          throw error; // throw để Worker biết job failed và retry
        }
      })
    );

    // Kiểm tra kết quả, nếu có kênh nào fail thì throw lỗi tổng để BullMQ retry
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      throw new Error(`[NotificationService] Dispatch failed for ${failed.length} channels`);
    }
  }
}

export const notificationService = new NotificationService();
