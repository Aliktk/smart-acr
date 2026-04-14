import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
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
  private readonly logger = new Logger("AuthGuard");

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = request.cookies?.acr_access_token;

    const ip = request.ip ?? request.headers["x-forwarded-for"] ?? "unknown";

    if (!token) {
      this.logger.warn(`Auth rejected: no token | IP=${ip} | ${request.method} ${request.url}`);
      throw new UnauthorizedException("Authentication required.");
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.getOrThrow("JWT_ACCESS_SECRET"),
        algorithms: ["HS256"],
      });

      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
        select: {
          userId: true,
          activeRole: true,
          expiresAt: true,
          revokedAt: true,
          lastUsedAt: true,
          createdAt: true,
          user: {
            select: {
              isActive: true,
            },
          },
        },
      });

      if (!session || session.userId !== payload.sub || !session.user.isActive) {
        const reason = !session ? "session_not_found" : session.userId !== payload.sub ? "user_mismatch" : "user_inactive";
        this.logger.warn(`Auth rejected: ${reason} | user=${payload.sub} session=${payload.sid} | IP=${ip}`);
        throw new UnauthorizedException("Session could not be resolved.");
      }

      if (session.revokedAt || session.expiresAt.getTime() < Date.now()) {
        this.logger.warn(`Auth rejected: ${session.revokedAt ? "session_revoked" : "session_expired"} | user=${payload.sub} session=${payload.sid} | IP=${ip}`);
        throw new UnauthorizedException("Session is invalid or expired.");
      }

      // Idle timeout check
      const idleTimeoutMs = this.configService.get<number>("SESSION_IDLE_TIMEOUT_MINUTES", 60) * 60 * 1000;
      if (session.lastUsedAt && Date.now() - session.lastUsedAt.getTime() > idleTimeoutMs) {
        const idleMinutes = Math.round((Date.now() - session.lastUsedAt.getTime()) / 60000);
        this.logger.warn(`Auth rejected: idle_timeout (${idleMinutes}m) | user=${payload.sub} session=${payload.sid} | IP=${ip}`);
        await this.prisma.session.update({
          where: { id: payload.sid },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException("Session expired due to inactivity. Please log in again.");
      }

      // Hard session lifetime check
      const maxLifetimeMs = this.configService.get<number>("SESSION_MAX_LIFETIME_HOURS", 10) * 60 * 60 * 1000;
      if (Date.now() - session.createdAt.getTime() > maxLifetimeMs) {
        const ageHours = Math.round((Date.now() - session.createdAt.getTime()) / 3600000);
        this.logger.warn(`Auth rejected: max_lifetime (${ageHours}h) | user=${payload.sub} session=${payload.sid} | IP=${ip}`);
        await this.prisma.session.update({
          where: { id: payload.sid },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException("Session has exceeded maximum lifetime. Please log in again.");
      }

      // Update lastUsedAt for idle tracking
      await this.prisma.session.update({
        where: { id: payload.sid },
        data: { lastUsedAt: new Date() },
      });

      request.user = {
        id: payload.sub,
        sessionId: payload.sid,
        activeRole: session.activeRole,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn(`Auth rejected: token_invalid | IP=${ip} | ${request.method} ${request.url} | ${error instanceof Error ? error.message : "unknown"}`);
      throw new UnauthorizedException("Session is invalid or expired.");
    }
  }
}
