import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { FileStorageType, UserAssetType, UserRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { validateProfileImageUpload } from "../../common/upload.constants";
import { ACTIVE_USER_ASSET_SELECT, groupUserAssets, mapUserAssetSummary } from "../../common/user-asset.mapper";
import { canAccessAcr, loadScopedUser } from "../../helpers/security.utils";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class UserAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getCurrentUserAssets(userId: string) {
    const assets = await this.prisma.userAsset.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: ACTIVE_USER_ASSET_SELECT,
      orderBy: {
        updatedAt: "desc",
      },
    });

    return groupUserAssets(assets);
  }

  async upsertCurrentUserAsset(
    userId: string,
    activeRole: UserRole,
    assetType: UserAssetType,
    file: Express.Multer.File | undefined,
    ipAddress?: string,
  ) {
    if (!file) {
      throw new BadRequestException("An image file is required.");
    }

    validateProfileImageUpload(file);

    await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, displayName: true },
    });

    const stored = await this.storageService.saveUploadedFile(file, {
      directory: `user-assets/${userId}`,
      fileNamePrefix: assetType.toLowerCase(),
    });

    const existing = await this.prisma.userAsset.findMany({
      where: {
        userId,
        assetType,
        isActive: true,
      },
      select: {
        id: true,
        filePath: true,
      },
    });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (existing.length > 0) {
          await tx.userAsset.updateMany({
            where: {
              id: {
                in: existing.map((asset) => asset.id),
              },
            },
            data: {
              isActive: false,
            },
          });
        }

        const nextAsset = await tx.userAsset.create({
          data: {
            userId,
            assetType,
            storageType: stored.storageType,
            filePath: stored.filePath,
            fileUrl: stored.fileUrl,
            originalName: stored.originalName,
            mimeType: stored.mimeType,
            fileSize: stored.fileSize,
            isActive: true,
          },
          select: ACTIVE_USER_ASSET_SELECT,
        });

        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: `${assetType === UserAssetType.SIGNATURE ? "Signature" : "Official stamp"} updated`,
            actorRole: this.displayRole(activeRole),
            recordType: "USER_ASSET",
            recordId: nextAsset.id,
            ipAddress: ipAddress ?? "unknown",
            details: `${assetType === UserAssetType.SIGNATURE ? "Signature" : "Official stamp"} uploaded for reusable profile asset storage.`,
          },
        });

        return nextAsset;
      });

      await Promise.all(existing.map((asset) => this.storageService.deleteStoredFile(asset.filePath)));
      return mapUserAssetSummary(created);
    } catch (error) {
      await this.storageService.deleteStoredFile(stored.filePath);
      throw error;
    }
  }

  async removeCurrentUserAsset(userId: string, activeRole: UserRole, assetType: UserAssetType, ipAddress?: string) {
    const existing = await this.prisma.userAsset.findMany({
      where: {
        userId,
        assetType,
        isActive: true,
      },
      select: {
        id: true,
        filePath: true,
      },
    });

    if (existing.length === 0) {
      return { removed: false };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userAsset.updateMany({
        where: {
          id: {
            in: existing.map((asset) => asset.id),
          },
        },
        data: {
          isActive: false,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: `${assetType === UserAssetType.SIGNATURE ? "Signature" : "Official stamp"} removed`,
          actorRole: this.displayRole(activeRole),
          recordType: "USER_ASSET",
          recordId: existing[0]?.id,
          ipAddress: ipAddress ?? "unknown",
          details: `${assetType === UserAssetType.SIGNATURE ? "Signature" : "Official stamp"} removed from reusable profile assets.`,
        },
      });
    });

    await Promise.all(existing.map((asset) => this.storageService.deleteStoredFile(asset.filePath)));
    return { removed: true };
  }

  async resolveAssetContentForUser(userId: string, activeRole: UserRole, assetId: string, acrId?: string) {
    const asset = await this.prisma.userAsset.findUnique({
      where: { id: assetId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!asset || !asset.isActive) {
      throw new NotFoundException("The requested profile asset could not be found.");
    }

    if (asset.userId !== userId) {
      if (activeRole === UserRole.SUPER_ADMIN || activeRole === UserRole.IT_OPS) {
        return this.readAssetFile(asset);
      }

      if (!acrId) {
        throw new ForbiddenException("You are not allowed to access this profile asset.");
      }

      const scopedUser = await loadScopedUser(this.prisma, userId, activeRole);
      const acr = await this.prisma.acrRecord.findUnique({
        where: { id: acrId },
        include: {
          employee: true,
          timeline: {
            select: {
              actorId: true,
            },
          },
        },
      });

      if (!acr || !canAccessAcr(scopedUser, acr)) {
        throw new ForbiddenException("You are not allowed to access this profile asset.");
      }

      const allowedOfficerIds = new Set(
        [
          acr.initiatedById,
          acr.reportingOfficerId,
          acr.countersigningOfficerId,
          acr.currentHolderId,
          acr.secretBranchAllocatedToId,
          acr.secretBranchVerifiedById,
        ].filter((value): value is string => Boolean(value)),
      );

      if (!allowedOfficerIds.has(asset.userId)) {
        throw new ForbiddenException("This profile asset is not linked to the requested ACR.");
      }
    }

    return this.readAssetFile(asset);
  }

  private async readAssetFile(asset: {
    id: string;
    filePath: string;
    mimeType: string;
    originalName: string;
    storageType: FileStorageType;
  }) {
    if (asset.storageType !== FileStorageType.LOCAL) {
      throw new NotFoundException("The requested profile asset storage provider is not configured.");
    }

    const absolutePath = await this.storageService.assertReadable(asset.filePath);

    return {
      absolutePath,
      fileName: asset.originalName,
      mimeType: asset.mimeType,
    };
  }

  private displayRole(role: UserRole) {
    if (role === UserRole.DG) {
      return "DG";
    }

    if (role === UserRole.EXECUTIVE_VIEWER) {
      return "DG Viewer";
    }

    if (role === UserRole.IT_OPS) {
      return "IT Ops";
    }

    return role
      .split("_")
      .map((segment) => segment[0] + segment.slice(1).toLowerCase())
      .join(" ");
  }
}
