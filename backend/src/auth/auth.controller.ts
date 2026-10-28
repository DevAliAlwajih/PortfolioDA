import { Body, Controller, Get, NotFoundException, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../common/prisma.service';

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) password: string;
}
class ForgotDto {
  @IsEmail() email: string;
}
class ResetDto {
  @IsEmail() email: string;
  @IsString() @Length(6, 6) code: string;
  @IsString() @MinLength(8) newPassword: string;
}
class ChangeEmailRequestDto {
  @IsEmail() newEmail: string;
  @IsString() @MinLength(1) password: string;
}
class ConfirmCodeDto {
  @IsString() @Length(6, 6) code: string;
}
class ChangePasswordRequestDto {
  @IsString() @MinLength(1) currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot')
  forgot(@Body() dto: ForgotDto) {
    return this.auth.forgot(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset')
  reset(@Body() dto: ResetDto) {
    return this.auth.reset(dto.email, dto.code, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    const admin = await this.prisma.admin.findUnique({ where: { id: req.admin.sub } });
    if (!admin) throw new NotFoundException('Admin not found');
    return { email: admin.email };
  }

  // ─── Email change ─────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('change-email/request')
  changeEmailRequest(@Req() req: any, @Body() dto: ChangeEmailRequestDto) {
    return this.auth.requestEmailChange(req.admin.sub, dto.newEmail, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-email/confirm')
  changeEmailConfirm(@Req() req: any, @Body() dto: ConfirmCodeDto) {
    return this.auth.confirmEmailChange(req.admin.sub, dto.code);
  }

  // ─── Password change ──────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('change-password/request')
  changePasswordRequest(@Req() req: any, @Body() dto: ChangePasswordRequestDto) {
    return this.auth.requestPasswordChange(req.admin.sub, dto.currentPassword, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('change-password/confirm')
  changePasswordConfirm(@Req() req: any, @Body() dto: ConfirmCodeDto) {
    return this.auth.confirmPasswordChange(req.admin.sub, dto.code);
  }
}
