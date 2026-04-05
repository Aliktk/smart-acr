import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { PrismaService } from "../prisma.service";

interface JwtPayload {
  sub: string;
  sid: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = request.cookies?.acr_access_token;

    if (!token) {
      throw new UnauthorizedException("Authentication required.");
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow("JWT_ACCESS_SECRET"),
      });

      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
        select: {
          userId: true,
          activeRole: true,
          expiresAt: true,
          revokedAt: true,
          user: {
            select: {
              isActive: true,
            },
          },
        },
      });

      if (!session || session.userId !== payload.sub || !session.user.isActive) {
        throw new UnauthorizedException("Session could not be resolved.");
      }

      if (session.revokedAt || session.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedException("Session is invalid or expired.");
      }

      request.user = {
        id: payload.sub,
        sessionId: payload.sid,
        activeRole: session.activeRole,
      };

      return true;
    } catch {
      throw new UnauthorizedException("Session is invalid or expired.");
    }
  }
}
