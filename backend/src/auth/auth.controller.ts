import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

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
class ChangeDto {
  @IsString() current: string;
  @IsString() @MinLength(8) next: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
  me(@Req() req: any) {
    return { email: req.admin.email };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  change(@Req() req: any, @Body() dto: ChangeDto) {
    return this.auth.changePassword(req.admin.sub, dto.current, dto.next);
  }
}
