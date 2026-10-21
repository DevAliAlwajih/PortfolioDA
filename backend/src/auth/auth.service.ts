import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { MailService } from '../common/mail.service';

const RESET_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async login(email: string, password: string) {
    const admin = await this.prisma.admin.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Same error for unknown email and wrong password.
    const ok = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
    if (!admin || !ok) throw new UnauthorizedException('Invalid email or password');
    const token = await this.jwt.signAsync({ sub: admin.id, email: admin.email });
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
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12), resetCode: null, resetExpires: null },
    });
    return { ok: true };
  }

  async changePassword(adminId: number, current: string, next: string) {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin || !(await bcrypt.compare(current, admin.passwordHash))) {
      throw new UnauthorizedException('Current password is wrong');
    }
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { passwordHash: await bcrypt.hash(next, 12) },
    });
    return { ok: true };
  }
}
