import { BadRequestException } from "@nestjs/common";
import { UserAssetType, UserRole } from "@prisma/client";
import { UserAssetsService } from "./user-assets.service";

describe("UserAssetsService", () => {
  const storageService = {
    saveUploadedFile: jest.fn(),
    deleteStoredFile: jest.fn().mockResolvedValue(undefined),
    assertReadable: jest.fn().mockResolvedValue("D:/storage/user-assets/user-1/signature.png"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads a reusable signature, deactivates the old one, and preserves the stored file metadata", async () => {
    storageService.saveUploadedFile.mockResolvedValue({
      storageType: "LOCAL",
      filePath: "user-assets/user-1/signature-new.png",
      fileUrl: null,
      storedFileName: "signature-new.png",
      originalName: "signature.png",
      mimeType: "image/png",
      fileSize: 1280,
    });

    const tx = {
      userAsset: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({
          id: "asset-new",
          assetType: "SIGNATURE",
          storageType: "LOCAL",
          originalName: "signature.png",
          mimeType: "image/png",
          fileSize: 1280,
          updatedAt: new Date("2026-04-08T10:00:00.000Z"),
          isActive: true,
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "user-1", displayName: "DSP Khalid Mehmood" }),
      },
      userAsset: {
        findMany: jest.fn().mockResolvedValue([{ id: "asset-old", filePath: "user-assets/user-1/signature-old.png" }]),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (inner: typeof tx) => unknown) => callback(tx)),
    };

    const service = new UserAssetsService(prisma as never, storageService as never);
    const result = await service.upsertCurrentUserAsset(
      "user-1",
      UserRole.REPORTING_OFFICER,
      UserAssetType.SIGNATURE,
      {
        buffer: Buffer.from("signature"),
        originalname: "signature.png",
        mimetype: "image/png",
        size: 1280,
      } as Express.Multer.File,
      "127.0.0.1",
    );

    expect(storageService.saveUploadedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        originalname: "signature.png",
      }),
      expect.objectContaining({
        directory: "user-assets/user-1",
      }),
    );
    expect(tx.userAsset.updateMany).toHaveBeenCalled();
    expect(tx.userAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          filePath: "user-assets/user-1/signature-new.png",
          mimeType: "image/png",
          fileSize: 1280,
          originalName: "signature.png",
        }),
      }),
    );
    expect(storageService.deleteStoredFile).toHaveBeenCalledWith("user-assets/user-1/signature-old.png");
    expect(result).toMatchObject({
      id: "asset-new",
      assetType: "SIGNATURE",
      fileName: "signature.png",
    });
  });

  it("rejects unsupported image types before storing a reusable asset", async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn(),
      },
    };
    const service = new UserAssetsService(prisma as never, storageService as never);

    await expect(
      service.upsertCurrentUserAsset(
        "user-1",
        UserRole.REPORTING_OFFICER,
        UserAssetType.SIGNATURE,
        {
          buffer: Buffer.from("pdf"),
          originalname: "signature.pdf",
          mimetype: "application/pdf",
          size: 100,
        } as Express.Multer.File,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(storageService.saveUploadedFile).not.toHaveBeenCalled();
  });

  it("rejects oversized reusable assets before storing them", async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn(),
      },
    };
    const service = new UserAssetsService(prisma as never, storageService as never);

    await expect(
      service.upsertCurrentUserAsset(
        "user-1",
        UserRole.REPORTING_OFFICER,
        UserAssetType.STAMP,
        {
          buffer: Buffer.from("oversized"),
          originalname: "stamp.png",
          mimetype: "image/png",
          size: 3 * 1024 * 1024,
        } as Express.Multer.File,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(storageService.saveUploadedFile).not.toHaveBeenCalled();
  });

  it("removes the active stamp and deletes the stored file", async () => {
    const tx = {
      userAsset: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };
    const prisma = {
      userAsset: {
        findMany: jest.fn().mockResolvedValue([{ id: "asset-stamp", filePath: "user-assets/user-1/stamp.png" }]),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (inner: typeof tx) => unknown) => callback(tx)),
    };
    const service = new UserAssetsService(prisma as never, storageService as never);

    const result = await service.removeCurrentUserAsset("user-1", UserRole.COUNTERSIGNING_OFFICER, UserAssetType.STAMP, "127.0.0.1");

    expect(tx.userAsset.updateMany).toHaveBeenCalled();
    expect(storageService.deleteStoredFile).toHaveBeenCalledWith("user-assets/user-1/stamp.png");
    expect(result).toEqual({ removed: true });
  });
});
