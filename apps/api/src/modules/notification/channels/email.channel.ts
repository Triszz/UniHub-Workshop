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
      // Đọc template tương ứng với type
      const templatePath = path.join(__dirname, '..', 'templates', `${type}.html`);
      let html = await fs.readFile(templatePath, 'utf-8');

      // Replace các biến trong template {{key}} -> value
      const data = { ...payload, fullName: user.fullName };
      for (const [key, value] of Object.entries(data)) {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }

      // Xác định subject dựa vào type
      let subject = 'Thông báo từ UniHub Workshop';
      if (type === 'registration_confirmed') {
        subject = 'Xác nhận đăng ký Workshop thành công';
      } else if (type === 'workshop_reminder') {
        subject = 'Nhắc nhở: Workshop sắp diễn ra';
      } else if (type === 'workshop_cancelled') {
        subject = 'Thông báo hủy Workshop';
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
