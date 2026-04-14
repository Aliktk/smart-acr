import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

describe("AuthService password reset flows", () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === "NODE_ENV") {
        return "test";
      }

      if (key === "FORGOT_PASSWORD_ENABLED") {
        return true;
      }

      if (key === "FORGOT_PASSWORD_TOKEN_TTL_MINUTES") {
        return 30;
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
    verify: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("issues a self-service password reset token and records the request", async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "user-1",
          username: "s.adnan",
          email: "s.adnan@fia.gov.pk",
          badgeNo: "FIA-2019-0451",
          isActive: true,
        }),
      },
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: "reset-1" }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };

    const service = new AuthService(prisma as never, jwtService as never, configService as never);
    const result = await service.requestPasswordReset("s.adnan", "127.0.0.1");

    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", consumedAt: null }),
      }),
    );
    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "Password reset requested",
          recordType: "USER",
        }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.message).toEqual(expect.any(String));
  });

  it("completes a valid reset token flow, revokes sessions, and writes an audit log", async () => {
    const resetToken = "reset-token-1";
    const prisma = {
      passwordResetToken: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "reset-1",
            userId: "user-1",
            tokenHash: await bcrypt.hash(resetToken, 10),
            user: {
              username: "s.adnan",
            },
          },
        ]),
        update: jest.fn().mockResolvedValue({ id: "reset-1" }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: "user-1" }),
      },
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" }),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const service = new AuthService(prisma as never, jwtService as never, configService as never);
    const result = await service.completePasswordReset(resetToken, "NewPass!2", "127.0.0.1");

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          mustChangePassword: false,
        }),
      }),
    );
    expect(prisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", revokedAt: null }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "Password reset completed",
        }),
      }),
    );
    expect(result).toEqual({
      success: true,
      message: "Password updated successfully. You can now sign in with the new password.",
    });
  });
});
