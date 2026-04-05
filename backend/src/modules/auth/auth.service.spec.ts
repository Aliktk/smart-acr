import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === "NODE_ENV") {
        return "test";
      }

      return undefined;
    }),
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string | number> = {
        JWT_ACCESS_SECRET: "test-access-secret-1234",
        JWT_REFRESH_SECRET: "test-refresh-secret-1234",
        ACCESS_TOKEN_TTL: "15m",
        REFRESH_TOKEN_TTL_DAYS: 7,
      };

      return values[key];
    }),
  };

  const jwtService = {
    sign: jest.fn((payload: Record<string, unknown>) => JSON.stringify(payload)),
  };

  const buildResponse = () => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    req: {
      cookies: {
        acr_refresh_token: "existing-refresh-token",
      },
    },
  });

  const buildUser = async () => ({
    id: "user-1",
    username: "s.adnan",
    displayName: "Syed Adnan Hussain",
    email: "s.adnan@fia.gov.pk",
    badgeNo: "FIA-2019-0451",
    mobileNumber: "0300-1111222",
    updatedAt: new Date("2026-04-03T00:00:00.000Z"),
    passwordHash: await bcrypt.hash("Passw0rd!", 10),
    twoFactorEnabled: false,
    isActive: true,
    roleAssignments: [{ role: UserRole.CLERK }, { role: UserRole.REPORTING_OFFICER }],
    wing: { id: "wing-1", name: "Immigration Wing" },
    zone: { id: "zone-1", name: "Islamabad Capital Zone" },
    office: { id: "office-1", name: "FIA HQ Islamabad" },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs in a valid user, sets cookies, and returns the mapped session", async () => {
    const user = await buildUser();
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      session: {
        create: jest.fn().mockResolvedValue({ id: "session-1" }),
        update: jest.fn().mockResolvedValue({ id: "session-1" }),
      },
    };
    const service = new AuthService(prisma as never, jwtService as never, configService as never);
    const response = buildResponse();

    const result = await service.login("s.adnan", "Passw0rd!", response as never, "127.0.0.1", "jest");

    expect(prisma.user.findFirst).toHaveBeenCalled();
    expect(prisma.session.create).toHaveBeenCalled();
    expect(prisma.session.update).toHaveBeenCalled();
    expect(response.cookie).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      status: "authenticated",
      session: {
        id: "user-1",
        name: "Syed Adnan Hussain",
        activeRole: "Clerk",
        availableRoles: ["Clerk", "Reporting Officer"],
      },
    });
  });

  it("accepts badge number as a login identifier", async () => {
    const user = await buildUser();
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      session: {
        create: jest.fn().mockResolvedValue({ id: "session-1" }),
        update: jest.fn().mockResolvedValue({ id: "session-1" }),
      },
    };
    const service = new AuthService(prisma as never, jwtService as never, configService as never);

    const result = await service.login("FIA-2019-0451", "Passw0rd!", buildResponse() as never, "127.0.0.1", "jest");

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ badgeNo: "FIA-2019-0451" }]),
        }),
      }),
    );
    expect(result.status).toBe("authenticated");
  });

  it("normalizes email identifiers before lookup", async () => {
    const user = await buildUser();
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      session: {
        create: jest.fn().mockResolvedValue({ id: "session-1" }),
        update: jest.fn().mockResolvedValue({ id: "session-1" }),
      },
    };
    const service = new AuthService(prisma as never, jwtService as never, configService as never);

    await service.login("  S.ADNAN@FIA.GOV.PK  ", "Passw0rd!", buildResponse() as never, "127.0.0.1", "jest");

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ email: "s.adnan@fia.gov.pk" }]),
        }),
      }),
    );
  });

  it("normalizes badge number casing before lookup", async () => {
    const user = await buildUser();
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      session: {
        create: jest.fn().mockResolvedValue({ id: "session-1" }),
        update: jest.fn().mockResolvedValue({ id: "session-1" }),
      },
    };
    const service = new AuthService(prisma as never, jwtService as never, configService as never);

    await service.login("fia-2019-0451", "Passw0rd!", buildResponse() as never, "127.0.0.1", "jest");

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ badgeNo: "FIA-2019-0451" }]),
        }),
      }),
    );
  });

  it("returns the absolute challenge expiry for two-factor sign-in", async () => {
    const user = { ...(await buildUser()), twoFactorEnabled: true };
    const expiresAt = new Date(Date.now() + 105_000);
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      authChallenge: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({
          id: "challenge-1",
          userId: user.id,
          codeHash: "hashed-code",
          maskedDestination: "registered mobile ending in 2222",
          expiresAt,
          ipAddress: "127.0.0.1",
          userAgent: "jest",
        }),
      },
    };
    const service = new AuthService(prisma as never, jwtService as never, configService as never);

    const result = await service.requestChallenge("s.adnan", "Passw0rd!", buildResponse() as never, "127.0.0.1", "jest");

    expect(result).toMatchObject({
      status: "challenge_required",
      challengeId: "challenge-1",
      expiresInSeconds: 105,
      expiresAt: expiresAt.toISOString(),
    });
  });

  it("rejects invalid credentials", async () => {
    const user = await buildUser();
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      session: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const service = new AuthService(prisma as never, jwtService as never, configService as never);

    await expect(service.login("s.adnan", "wrong-password", buildResponse() as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("blocks switching to a role the user does not have", async () => {
    const user = await buildUser();
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({
          id: "session-1",
          userId: "user-1",
          activeRole: UserRole.CLERK,
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          user,
        }),
        update: jest.fn(),
      },
    };
    const service = new AuthService(prisma as never, jwtService as never, configService as never);

    await expect(
      service.switchRole("user-1", "session-1", UserRole.SECRET_BRANCH, buildResponse() as never),
    ).rejects.toThrow(ForbiddenException);
  });
});
