import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly from = process.env.MAIL_FROM || 'Portfolio <no-reply@localhost>';
  private readonly transport = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;

  async send(to: string, subject: string, text: string) {
    if (!this.transport) {
      // No SMTP configured: print so local development still works.
      // Never print codes in production.
      if (process.env.NODE_ENV !== 'production') {
        this.log.warn(`[DEV] Email to ${to} | Subject: ${subject}\n${text}`);
      }
      return;
    }
    await this.transport.sendMail({ from: this.from, to, subject, text });
  }
}
