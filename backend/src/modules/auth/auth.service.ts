import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "crypto";
import type { Response } from "express";
import { PrismaService } from "../../common/prisma.service";

const AUTH_CHALLENGE_TTL_SECONDS = 105;
const MAX_AUTH_CHALLENGE_ATTEMPTS = 5;

const AUTH_USER_INCLUDE = {
  roleAssignments: {
    include: {
      wing: true,
      zone: true,
      office: true,
    },
  },
  wing: true,
  zone: true,
  office: true,
} satisfies Prisma.UserInclude;

type AuthUserRecord = Prisma.UserGetPayload<{
  include: typeof AUTH_USER_INCLUDE;
}>;

type SessionRecord = Prisma.SessionGetPayload<{
  include: {
    user: {
      include: typeof AUTH_USER_INCLUDE;
    };
  };
}>;

type MappedSession = {
  id: string;
  name: string;
  email: string;
  badgeNo: string;
  hasAvatar: boolean;
  avatarVersion: string;
  activeRole: string;
  activeRoleCode: UserRole;
  availableRoles: string[];
  availableRoleCodes: UserRole[];
  scope: {
    wingId: string | null;
    wingName: string | null;
    zoneId: string | null;
    zoneName: string | null;
    officeId: string | null;
    officeName: string | null;
  };
};

type AuthResult =
  | {
      status: "challenge_required";
      challengeId: string;
      expiresInSeconds: number;
      expiresAt: string;
      maskedDestination: string;
      demoCode?: string;
    }
  | {
      status: "authenticated";
      session: MappedSession;
    };

interface AccessTokenPayload {
  sub: string;
  sid: string;
  role: UserRole;
}

interface RefreshTokenPayload {
  sub: string;
  sid: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async requestChallenge(
    username: string,
    password: string,
    response: Response,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    const user = await this.authenticateCredentials(username, password);
    return this.startAuthentication(user, response, ipAddress, userAgent);
  }

  async login(
    username: string,
    password: string,
    response: Response,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    const user = await this.authenticateCredentials(username, password);
    return this.startAuthentication(user, response, ipAddress, userAgent);
  }

  async verifyChallenge(
    challengeId: string,
    code: string,
    response: Response,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const challenge = await this.prisma.authChallenge.findFirst({
      where: {
        id: challengeId,
        consumedAt: null,
      },
    });

    if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
      if (challenge) {
        await this.consumeChallenge(challenge.id);
      }
      throw new UnauthorizedException("The verification code has expired. Please sign in again.");
    }

    const codeMatches = await bcrypt.compare(code, challenge.codeHash);
    if (!codeMatches) {
      const nextAttempts = challenge.attemptCount + 1;
      await this.prisma.authChallenge.update({
        where: { id: challenge.id },
        data: {
          attemptCount: nextAttempts,
          consumedAt: nextAttempts >= MAX_AUTH_CHALLENGE_ATTEMPTS ? new Date() : null,
        },
      });

      if (nextAttempts >= MAX_AUTH_CHALLENGE_ATTEMPTS) {
        throw new UnauthorizedException("Too many invalid verification attempts. Please sign in again.");
      }

      throw new UnauthorizedException("Invalid verification code.");
    }

    await this.consumeChallenge(challenge.id);

    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
      include: AUTH_USER_INCLUDE,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("User no longer exists.");
    }

    return this.createSessionForUser(user, response, ipAddress ?? challenge.ipAddress ?? undefined, userAgent ?? challenge.userAgent ?? undefined);
  }

  async resendChallenge(challengeId: string) {
    const challenge = await this.prisma.authChallenge.findFirst({
      where: {
        id: challengeId,
        consumedAt: null,
      },
      include: {
        user: true,
      },
    });

    if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
      if (challenge) {
        await this.consumeChallenge(challenge.id);
      }
      throw new UnauthorizedException("The verification session has expired. Please sign in again.");
    }

    const nextCode = this.generateOtpCode();
    const expiresAt = this.challengeExpiry();
    await this.prisma.authChallenge.update({
      where: { id: challenge.id },
      data: {
        codeHash: await bcrypt.hash(nextCode, 10),
        attemptCount: 0,
        expiresAt,
        lastSentAt: new Date(),
      },
    });

    return {
      status: "challenge_required" as const,
      challengeId,
      expiresInSeconds: AUTH_CHALLENGE_TTL_SECONDS,
      expiresAt: expiresAt.toISOString(),
      maskedDestination: challenge.maskedDestination,
      ...(this.isProduction() ? {} : { demoCode: nextCode }),
    };
  }

  async refreshSession(response: Response) {
    const refreshToken = response.req?.cookies?.acr_refresh_token;
    if (!refreshToken) {
      this.clearCookies(response);
      throw new UnauthorizedException("Refresh token is missing.");
    }

    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
        secret: this.configService.getOrThrow("JWT_REFRESH_SECRET"),
      });
    } catch {
      this.clearCookies(response);
      throw new UnauthorizedException("Refresh token is invalid or expired.");
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          include: AUTH_USER_INCLUDE,
        },
      },
    });

    if (!session || session.userId !== payload.sub) {
      this.clearCookies(response);
      throw new UnauthorizedException("Session could not be resolved.");
    }

    this.assertSessionState(session);

    const refreshMatches = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!refreshMatches) {
      await this.revokeSession(session.id);
      this.clearCookies(response);
      throw new UnauthorizedException("Refresh token validation failed.");
    }

    const activeRole = this.resolveSessionRole(session.user, session.activeRole);
    const nextRefreshToken = this.signRefreshToken(session.userId, session.id);
    const nextExpiresAt = this.sessionExpiry();

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        activeRole,
        refreshTokenHash: await bcrypt.hash(nextRefreshToken, 12),
        expiresAt: nextExpiresAt,
        lastUsedAt: new Date(),
      },
    });

    this.setCookies(response, session.userId, session.id, activeRole, nextRefreshToken);

    return this.mapSession(session.user, activeRole);
  }

  async getSessionUser(userId: string, activeRole: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: AUTH_USER_INCLUDE,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("User no longer exists.");
    }

    return this.mapSession(user, this.resolveSessionRole(user, activeRole));
  }

  async switchRole(userId: string, sessionId: string, nextRole: UserRole, response: Response, ipAddress?: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: AUTH_USER_INCLUDE,
        },
      },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException("The current session is no longer valid.");
    }

    this.assertSessionState(session);

    if (!session.user.roleAssignments.some((assignment) => assignment.role === nextRole)) {
      throw new ForbiddenException("Requested role is not assigned to the user.");
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        activeRole: nextRole,
        lastUsedAt: new Date(),
      },
    });

    const existingRefreshToken = response.req?.cookies?.acr_refresh_token;
    this.setCookies(response, userId, session.id, nextRole, existingRefreshToken);
    await this.createAuditEntry({
      actorId: userId,
      actorRole: this.displayRole(session.activeRole),
      action: "Role switched",
      details: `Active role changed to ${this.displayRole(nextRole)}.`,
      ipAddress,
    });

    return this.mapSession(session.user, nextRole);
  }

  async logout(userId: string, sessionId: string, activeRole: UserRole, response: Response, ipAddress?: string) {
    await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        userId,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.createAuditEntry({
      actorId: userId,
      actorRole: this.displayRole(activeRole),
      action: "User logout",
      details: "User ended the current portal session.",
      ipAddress,
    });

    this.clearCookies(response);
    return { success: true };
  }

  private async authenticateCredentials(username: string, password: string) {
    const normalizedIdentifier = this.normalizeAuthIdentifier(username);
    const user = await this.resolveActiveUser(normalizedIdentifier);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    return user;
  }

  private async startAuthentication(
    user: AuthUserRecord,
    response: Response,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    if (!user.twoFactorEnabled) {
      const session = await this.createSessionForUser(user, response, ipAddress, userAgent);
      return {
        status: "authenticated",
        session,
      };
    }

    const challenge = await this.createChallenge(user, ipAddress, userAgent);
    return {
      status: "challenge_required",
      challengeId: challenge.id,
      expiresInSeconds: AUTH_CHALLENGE_TTL_SECONDS,
      expiresAt: challenge.expiresAt.toISOString(),
      maskedDestination: challenge.maskedDestination,
      ...(this.isProduction() ? {} : { demoCode: challenge.otpCode }),
    };
  }

  private async resolveActiveUser(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier },
          { badgeNo: this.normalizeBadgeNumber(identifier) },
        ],
        isActive: true,
      },
      include: AUTH_USER_INCLUDE,
    });
  }

  private normalizeAuthIdentifier(identifier: string) {
    return identifier.trim().toLowerCase();
  }

  private normalizeBadgeNumber(identifier: string) {
    return identifier.trim().toUpperCase();
  }

  private async createSessionForUser(user: AuthUserRecord, response: Response, ipAddress?: string, userAgent?: string) {
    const defaultRole = user.roleAssignments[0]?.role ?? UserRole.CLERK;
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        activeRole: defaultRole,
        refreshTokenHash: "",
        ipAddress,
        userAgent,
        expiresAt: this.sessionExpiry(),
      },
    });

    const refreshToken = this.signRefreshToken(user.id, session.id);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: await bcrypt.hash(refreshToken, 12),
      },
    });

    this.setCookies(response, user.id, session.id, defaultRole, refreshToken);
    await this.createAuditEntry({
      actorId: user.id,
      actorRole: this.displayRole(defaultRole),
      action: "User login",
      details: `User authenticated successfully${userAgent ? ` via ${userAgent}` : ""}.`,
      ipAddress,
    });

    return this.mapSession(user, defaultRole);
  }

  private async createAuditEntry(params: {
    actorId: string;
    actorRole: string;
    action: string;
    details: string;
    ipAddress?: string;
  }) {
    await this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        actorRole: params.actorRole,
        ipAddress: params.ipAddress ?? "unknown",
        details: params.details,
      },
    });
  }

  private async createChallenge(user: AuthUserRecord, ipAddress?: string, userAgent?: string) {
    await this.prisma.authChallenge.updateMany({
      where: {
        userId: user.id,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    await this.prisma.authChallenge.deleteMany({
      where: {
        OR: [{ consumedAt: { not: null } }, { expiresAt: { lt: new Date() } }],
      },
    });

    const otpCode = this.generateOtpCode();
    const challenge = await this.prisma.authChallenge.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        codeHash: await bcrypt.hash(otpCode, 10),
        maskedDestination: this.maskDestination(user.mobileNumber, user.email, user.badgeNo),
        expiresAt: this.challengeExpiry(),
        ipAddress,
        userAgent,
      },
    });

    return {
      ...challenge,
      otpCode,
    };
  }

  private async consumeChallenge(challengeId: string) {
    await this.prisma.authChallenge.updateMany({
      where: {
        id: challengeId,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
  }

  private signRefreshToken(userId: string, sessionId: string) {
    return this.jwtService.sign(
      { sub: userId, sid: sessionId },
      {
        secret: this.configService.getOrThrow("JWT_REFRESH_SECRET"),
        expiresIn: `${this.refreshTokenTtlDays()}d`,
      },
    );
  }

  private setCookies(response: Response, userId: string, sessionId: string, role: UserRole, refreshToken?: string) {
    const accessToken = this.jwtService.sign(
      { sub: userId, sid: sessionId, role } satisfies AccessTokenPayload,
      {
        secret: this.configService.getOrThrow("JWT_ACCESS_SECRET"),
        expiresIn: this.configService.getOrThrow("ACCESS_TOKEN_TTL"),
      },
    );

    const cookieBase = {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: "lax" as const,
      path: "/",
    };

    response.cookie("acr_access_token", accessToken, cookieBase);
    if (refreshToken) {
      response.cookie("acr_refresh_token", refreshToken, {
        ...cookieBase,
        maxAge: this.refreshTokenTtlDays() * 24 * 60 * 60 * 1000,
      });
    }
  }

  private clearCookies(response: Response) {
    const cookieBase = {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: "lax" as const,
      path: "/",
    };

    response.clearCookie("acr_access_token", cookieBase);
    response.clearCookie("acr_refresh_token", cookieBase);
  }

  private assertSessionState(session: Pick<SessionRecord, "revokedAt" | "expiresAt">) {
    if (session.revokedAt) {
      throw new UnauthorizedException("Session has been revoked.");
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Session has expired.");
    }
  }

  private resolveSessionRole(user: AuthUserRecord, requestedRole: UserRole) {
    if (user.roleAssignments.some((assignment) => assignment.role === requestedRole)) {
      return requestedRole;
    }

    return user.roleAssignments[0]?.role ?? UserRole.CLERK;
  }

  private mapSession(user: AuthUserRecord, activeRole: UserRole): MappedSession {
    const sessionRole = this.resolveSessionRole(user, activeRole);
    const activeAssignment = user.roleAssignments.find((assignment) => assignment.role === sessionRole);

    return {
      id: user.id,
      name: user.displayName,
      email: user.email,
      badgeNo: user.badgeNo,
      hasAvatar: Boolean(user.avatarStoragePath),
      avatarVersion: user.updatedAt.toISOString(),
      activeRole: this.displayRole(sessionRole),
      activeRoleCode: sessionRole,
      availableRoles: user.roleAssignments.map((assignment) => this.displayRole(assignment.role)),
      availableRoleCodes: user.roleAssignments.map((assignment) => assignment.role),
      scope: {
        wingId: activeAssignment?.wing?.id ?? user.wing?.id ?? null,
        wingName: activeAssignment?.wing?.name ?? user.wing?.name ?? null,
        zoneId: activeAssignment?.zone?.id ?? user.zone?.id ?? null,
        zoneName: activeAssignment?.zone?.name ?? user.zone?.name ?? null,
        officeId: activeAssignment?.office?.id ?? user.office?.id ?? null,
        officeName: activeAssignment?.office?.name ?? user.office?.name ?? null,
      },
    };
  }

  private displayRole(role: UserRole) {
    return role
      .split("_")
      .map((part) => part[0] + part.slice(1).toLowerCase())
      .join(" ");
  }

  private generateOtpCode() {
    return randomInt(100000, 999999).toString();
  }

  private maskDestination(mobileNumber?: string | null, email?: string | null, badgeNo?: string | null) {
    const digits = (mobileNumber ?? "").replace(/\D/g, "");
    if (digits.length >= 4) {
      return `registered mobile ending in ${digits.slice(-4)}`;
    }

    if (email?.includes("@")) {
      const [localPart, domain] = email.split("@");
      const visible = localPart.slice(0, 2);
      return `${visible}***@${domain}`;
    }

    const badgeDigits = (badgeNo ?? "").replace(/\D/g, "");
    return `registered account ending in ${badgeDigits.slice(-2) || "23"}`;
  }

  private challengeExpiry() {
    return new Date(Date.now() + AUTH_CHALLENGE_TTL_SECONDS * 1000);
  }

  private sessionExpiry() {
    return new Date(Date.now() + this.refreshTokenTtlDays() * 24 * 60 * 60 * 1000);
  }

  private refreshTokenTtlDays() {
    return this.configService.getOrThrow<number>("REFRESH_TOKEN_TTL_DAYS");
  }

  private isProduction() {
    return this.configService.get("NODE_ENV") === "production";
  }

  private async revokeSession(sessionId: string) {
    await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
