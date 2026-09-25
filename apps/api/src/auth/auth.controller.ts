import { Body, Controller, Get, HttpCode, Post, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';
import { PrismaService } from '../prisma.service';
import { AUTH_COOKIE, AuthUser, CurrentUser, UserAuthGuard } from './auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email?: string; password?: string }, @Res({ passthrough: true }) res: Response) {
    const user = await this.prisma.user.findUnique({ where: { email: String(body.email ?? '').trim() } });
    if (!user || !(await bcrypt.compare(String(body.password ?? ''), user.passwordHash))) {
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }
    const token = this.jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role });
    res.cookie(AUTH_COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: 8 * 3600 * 1000 });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(UserAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
