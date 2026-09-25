import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { config } from '../config';

export const AUTH_COOKIE = 'token';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'sales' | 'admin';
}

/** Staff sessions: JWT in an httpOnly cookie (docs/09). */
@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) throw new UnauthorizedException('Chưa đăng nhập');
    try {
      const p = this.jwt.verify(token);
      req.user = { id: p.sub, email: p.email, name: p.name, role: p.role };
      return true;
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập hết hạn');
    }
  }
}

/** Mac mini agent: separate API key, only valid on /agent/* (docs/09). */
@Injectable()
export class AgentKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { agentId?: string }>();
    const given = Buffer.from(String(req.headers['x-agent-key'] ?? ''));
    const expected = Buffer.from(config.agentApiKey);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException('Invalid agent key');
    }
    req.agentId = String(req.headers['x-agent-id'] ?? 'macmini-1').slice(0, 64);
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user as AuthUser,
);

export const CurrentAgent = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().agentId as string,
);
