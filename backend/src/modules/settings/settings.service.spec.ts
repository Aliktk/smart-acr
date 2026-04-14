import { UnauthorizedException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { SettingsService } from "./settings.service";

describe("SettingsService", () => {
  const storageService = {
    saveUploadedFile: jest.fn(),
    deleteStoredFile: jest.fn(),
    assertReadable: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows a user to change their own password and writes an audit event", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          passwordHash: await bcrypt.hash("CurrentPass!1", 10),
        }),
        update: jest.fn().mockResolvedValue({ id: "user-1" }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };

    const service = new SettingsService(prisma as never, storageService as never);
    const result = await service.updatePassword(
      "user-1",
      UserRole.EMPLOYEE,
      {
        currentPassword: "CurrentPass!1",
        nextPassword: "NewPass!2",
      },
      "127.0.0.1",
    );

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          mustChangePassword: false,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "Password updated",
          actorRole: "Employee",
        }),
      }),
    );
    expect(result).toEqual({
      success: true,
      message: "Password updated successfully.",
    });
  });

  it("rejects password changes when the current password is incorrect", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          passwordHash: await bcrypt.hash("CurrentPass!1", 10),
        }),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const service = new SettingsService(prisma as never, storageService as never);

    await expect(
      service.updatePassword(
        "user-1",
        UserRole.EMPLOYEE,
        {
          currentPassword: "WrongPass!1",
          nextPassword: "NewPass!2",
        },
        "127.0.0.1",
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("includes the current reusable signature and stamp in the settings profile payload", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user-1",
          displayName: "DSP Khalid Mehmood",
          badgeNo: "FIA-1001",
          email: "khalid@fia.gov.pk",
          office: { name: "FIA HQ Islamabad" },
          avatarStoragePath: null,
          notificationPreferences: null,
          displayPreferences: null,
          passwordChangedAt: null,
          twoFactorEnabled: false,
          updatedAt: new Date("2026-04-08T08:00:00.000Z"),
          userAssets: [
            {
              id: "signature-1",
              assetType: "SIGNATURE",
              storageType: "LOCAL",
              originalName: "signature.png",
              mimeType: "image/png",
              fileSize: 1200,
              updatedAt: new Date("2026-04-08T08:30:00.000Z"),
              isActive: true,
            },
            {
              id: "stamp-1",
              assetType: "STAMP",
              storageType: "LOCAL",
              originalName: "stamp.png",
              mimeType: "image/png",
              fileSize: 2200,
              updatedAt: new Date("2026-04-08T08:45:00.000Z"),
              isActive: true,
            },
          ],
        }),
      },
    };

    const service = new SettingsService(prisma as never, storageService as never);
    const result = await service.getUserSettings("user-1", UserRole.REPORTING_OFFICER);

    expect(result.profile.signatureAsset).toMatchObject({
      id: "signature-1",
      assetType: "SIGNATURE",
      fileName: "signature.png",
    });
    expect(result.profile.stampAsset).toMatchObject({
      id: "stamp-1",
      assetType: "STAMP",
      fileName: "stamp.png",
    });
  });
});
