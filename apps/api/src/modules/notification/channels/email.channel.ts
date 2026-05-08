import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { NotificationChannel, NotificationPayload } from './channel.interface';
import { prisma } from '../../../shared/database/prisma';

export class EmailChannel implements NotificationChannel {
  name = 'email';
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
      port: Number(process.env.SMTP_PORT) || 2525,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async send(notification: NotificationPayload): Promise<void> {
    const { userId, type, payload } = notification;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.warn(`[EmailChannel] User ${userId} not found, skip sending.`);
      return;
    }

    try {
      let templateName = type;
      let subject = 'Thông báo từ UniHub Workshop';

      if (type === 'registration_confirmed') {
        subject = 'Xác nhận đăng ký Workshop thành công';
      } else if (type === 'workshop_reminder') {
        subject = 'Nhắc nhở: Workshop sắp diễn ra';
      } else if (type === 'workshop_reminder_1h') {
        subject = 'Nhắc nhở: Workshop sẽ bắt đầu sau 1 giờ';
      } else if (type === 'workshop_cancelled') {
        subject = 'Thông báo hủy Workshop';
      } else if (type === 'registration_lifecycle') {
        if (payload.milestone === 'registration_success') {
          templateName = 'registration_confirmed';
          subject = 'Xác nhận đăng ký Workshop thành công';
        } else {
          // Các milestone khác của lifecycle (như started, ended, reminder_1d) 
          // có thể không gửi qua email, hoặc gửi chung 1 template. 
          // Ở đây ta bỏ qua nếu không phải registration_success vì 1d/1h đã được xử lý bởi cron worker.
          console.log(`[EmailChannel] Skip email for lifecycle milestone: ${payload.milestone}`);
          return;
        }
      }

      // Đọc template tương ứng với templateName
      const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);
      let html = await fs.readFile(templatePath, 'utf-8');

      // Replace các biến trong template {{key}} -> value
      const data = { ...payload, fullName: user.fullName };
      for (const [key, value] of Object.entries(data)) {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }

      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || '"UniHub" <noreply@unihub.dev>',
        to: user.email,
        subject,
        html,
      });

      console.log(`[EmailChannel] Sent email to ${user.email} (type: ${type})`);
    } catch (error: any) {
      console.error(`[EmailChannel] Error sending email to ${user?.email}:`, error.message);
      throw error;
    }
  }
}
