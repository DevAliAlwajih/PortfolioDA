import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { MailService } from '../common/mail.service';

const RESET_MINUTES = 15;
const CODE_COOLDOWN_MS = 60_000; // 60 seconds between requests
const MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  private async signToken(admin: { id: number; email: string; tokenVersion: number }) {
    return this.jwt.signAsync({ sub: admin.id, email: admin.email, tv: admin.tokenVersion });
  }

  async login(email: string, password: string) {
    const admin = await this.prisma.admin.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Same error for unknown email and wrong password.
    const ok = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
    if (!admin || !ok) throw new UnauthorizedException('Invalid email or password');
    const token = await this.signToken(admin);
    return { token, email: admin.email };
  }

  async forgot(email: string) {
    const admin = await this.prisma.admin.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (admin) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await this.prisma.admin.update({
        where: { id: admin.id },
        data: {
          resetCode: await bcrypt.hash(code, 10),
          resetExpires: new Date(Date.now() + RESET_MINUTES * 60_000),
        },
      });
      await this.mail.send(
        admin.email,
        'Password reset code / رمز استعادة كلمة المرور',
        `Your code: ${code}\nرمز التحقق: ${code}\n\nValid for ${RESET_MINUTES} minutes. If you did not ask for this, ignore this email.`,
      );
    }
    // Same answer whether or not the email exists.
    return { ok: true };
  }

  async reset(email: string, code: string, newPassword: string) {
    const admin = await this.prisma.admin.findUnique({ where: { email: email.trim().toLowerCase() } });
    const valid =
      !!admin &&
      !!admin.resetCode &&
      !!admin.resetExpires &&
      admin.resetExpires.getTime() > Date.now() &&
      (await bcrypt.compare(code, admin.resetCode));
    if (!admin || !valid) throw new BadRequestException('Invalid or expired code');
    const updated = await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        resetCode: null,
        resetExpires: null,
        tokenVersion: { increment: 1 },
      },
    });
    const token = await this.signToken(updated);
    return { token, email: updated.email };
  }

  // ─── Email change ────────────────────────────────────────────────────────────

  async requestEmailChange(adminId: number, newEmail: string, password: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Current password is wrong');
    }

    const normalized = newEmail.trim().toLowerCase();
    if (normalized === admin.email) {
      throw new BadRequestException('New email is the same as the current email');
    }

    const conflict = await this.prisma.admin.findUnique({ where: { email: normalized } });
    if (conflict) throw new BadRequestException('That email is already in use');

    // Cooldown check
    const existing = await this.prisma.adminAction.findUnique({
      where: { adminId_type: { adminId, type: 'EMAIL_CHANGE' } },
    });
    if (existing) {
      const elapsed = Date.now() - existing.createdAt.getTime();
      if (elapsed < CODE_COOLDOWN_MS) {
        const wait = Math.ceil((CODE_COOLDOWN_MS - elapsed) / 1000);
        throw new HttpException(`Please wait ${wait} seconds before requesting another code`, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);

    const action = await this.prisma.adminAction.upsert({
      where: { adminId_type: { adminId, type: 'EMAIL_CHANGE' } },
      update: { payload: normalized, codeHash, expiresAt: new Date(Date.now() + 15 * 60_000), attempts: 0, createdAt: new Date() },
      create: { adminId, type: 'EMAIL_CHANGE', payload: normalized, codeHash, expiresAt: new Date(Date.now() + 15 * 60_000) },
    });

    // Send code to NEW address, notice to CURRENT address
    try {
      await this.mail.send(
        normalized,
        'Email change verification code',
        `Your 6-digit code to confirm email change: ${code}\n\nValid for 15 minutes.`,
      );
      await this.mail.send(
        admin.email,
        'Email change requested on your account',
        `A request was made to change your admin email to ${normalized}.\n\nIf this was not you, contact your system administrator immediately.`,
      );
    } catch (err) {
      await this.prisma.adminAction.delete({ where: { id: action.id } });
      throw new InternalServerErrorException('Could not send the email');
    }

    return { ok: true };
  }

  async confirmEmailChange(adminId: number, code: string) {
    const action = await this.prisma.adminAction.findUnique({
      where: { adminId_type: { adminId, type: 'EMAIL_CHANGE' } },
    });
    if (!action || action.expiresAt < new Date()) {
      if (action) await this.prisma.adminAction.delete({ where: { id: action.id } });
      throw new BadRequestException('No pending email change or it has expired');
    }

    const match = await bcrypt.compare(code, action.codeHash);
    if (!match) {
      const attempts = action.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await this.prisma.adminAction.delete({ where: { id: action.id } });
      } else {
        await this.prisma.adminAction.update({ where: { id: action.id }, data: { attempts } });
      }
      throw new BadRequestException('Invalid code');
    }

    const oldEmail = (await this.prisma.admin.findUnique({ where: { id: adminId } }))!.email;
    const updated = await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        email: action.payload,
        resetCode: null,
        resetExpires: null,
        tokenVersion: { increment: 1 },
      },
    });
    await this.prisma.adminAction.delete({ where: { id: action.id } });

    await this.mail.send(
      oldEmail,
      'Your admin email has been changed',
      `Your account email was changed to ${updated.email}. If this was not you, contact your system administrator.`,
    ).catch(() => {/* notice only, ignore failures */});

    const token = await this.signToken(updated);
    return { token, email: updated.email };
  }

  // ─── Password change ─────────────────────────────────────────────────────────

  async requestPasswordChange(adminId: number, currentPassword: string, newPassword: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      throw new UnauthorizedException('Current password is wrong');
    }

    const sameAsOld = await bcrypt.compare(newPassword, admin.passwordHash);
    if (sameAsOld) throw new BadRequestException('New password must differ from the current one');

    // Cooldown check
    const existing = await this.prisma.adminAction.findUnique({
      where: { adminId_type: { adminId, type: 'PASSWORD_CHANGE' } },
    });
    if (existing) {
      const elapsed = Date.now() - existing.createdAt.getTime();
      if (elapsed < CODE_COOLDOWN_MS) {
        const wait = Math.ceil((CODE_COOLDOWN_MS - elapsed) / 1000);
        throw new HttpException(`Please wait ${wait} seconds before requesting another code`, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const hash = await bcrypt.hash(newPassword, 12);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);

    const action = await this.prisma.adminAction.upsert({
      where: { adminId_type: { adminId, type: 'PASSWORD_CHANGE' } },
      update: { payload: hash, codeHash, expiresAt: new Date(Date.now() + 15 * 60_000), attempts: 0, createdAt: new Date() },
      create: { adminId, type: 'PASSWORD_CHANGE', payload: hash, codeHash, expiresAt: new Date(Date.now() + 15 * 60_000) },
    });

    try {
      await this.mail.send(
        admin.email,
        'Password change verification code',
        `Your 6-digit code to confirm password change: ${code}\n\nValid for 15 minutes.`,
      );
    } catch (err) {
      await this.prisma.adminAction.delete({ where: { id: action.id } });
      throw new InternalServerErrorException('Could not send the email');
    }

    return { ok: true };
  }

  async confirmPasswordChange(adminId: number, code: string) {
    const action = await this.prisma.adminAction.findUnique({
      where: { adminId_type: { adminId, type: 'PASSWORD_CHANGE' } },
    });
    if (!action || action.expiresAt < new Date()) {
      if (action) await this.prisma.adminAction.delete({ where: { id: action.id } });
      throw new BadRequestException('No pending password change or it has expired');
    }

    const match = await bcrypt.compare(code, action.codeHash);
    if (!match) {
      const attempts = action.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await this.prisma.adminAction.delete({ where: { id: action.id } });
      } else {
        await this.prisma.adminAction.update({ where: { id: action.id }, data: { attempts } });
      }
      throw new BadRequestException('Invalid code');
    }

    const updated = await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        passwordHash: action.payload,
        resetCode: null,
        resetExpires: null,
        tokenVersion: { increment: 1 },
      },
    });
    await this.prisma.adminAction.delete({ where: { id: action.id } });

    await this.mail.send(
      updated.email,
      'Your password has been changed',
      `Your admin account password was successfully changed. If this was not you, contact your system administrator immediately.`,
    ).catch(() => {/* notice only */});

    const token = await this.signToken(updated);
    return { token, email: updated.email };
  }
}
