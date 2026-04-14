import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PrismaService } from "../../common/prisma.service";
import { canAccessAcr, canAccessEmployee, loadScopedUser } from "../../helpers/security.utils";

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async recordFile(
    userId: string,
    acrRecordId: string | undefined,
    kind: "SIGNATURE" | "STAMP" | "DOCUMENT",
    file: Express.Multer.File,
    archiveRecordId?: string,
  ) {
    const created = await this.prisma.fileAsset.create({
      data: {
        acrRecordId,
        archiveRecordId,
        uploadedById: userId,
        kind,
        fileName: file.filename,
        mimeType: file.mimetype,
        storagePath: this.toStorageRelativePath(file.path),
      },
    });

    return {
      id: created.id,
      kind: created.kind,
      fileName: created.fileName,
      mimeType: created.mimeType,
      storagePath: created.storagePath,
      contentUrl: `/api/v1/files/${created.id}/content`,
    };
  }

  async resolveFileForUser(userId: string, activeRole: UserRole, fileId: string) {
    const file = await this.prisma.fileAsset.findUnique({
      where: { id: fileId },
      include: {
        acrRecord: {
          include: {
            employee: true,
          },
        },
        archiveRecord: {
          include: {
            employee: true,
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException("The requested file could not be found.");
    }

    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (activeRole === UserRole.EMPLOYEE && (file.acrRecord || file.archiveRecord)) {
      throw new ForbiddenException("Employees can view archive metadata only and cannot access stored documents.");
    }

    if (file.acrRecord) {
      if (!canAccessAcr(user, file.acrRecord)) {
        throw new ForbiddenException("You are not allowed to access this file.");
      }
    } else if (file.archiveRecord) {
      if (!canAccessEmployee(user, file.archiveRecord.employee)) {
        throw new ForbiddenException("You are not allowed to access this archived file.");
      }
    } else if (file.uploadedById && file.uploadedById !== userId) {
      throw new ForbiddenException("You are not allowed to access this file.");
    }

    const absolutePath = this.resolveStoragePath(file.storagePath);

    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException("The requested file is no longer available in storage.");
    }

    return {
      absolutePath,
      mimeType: file.mimeType,
      fileName: file.fileName,
    };
  }

  async deleteStoredFile(storedPath?: string | null) {
    if (!storedPath) {
      return;
    }

    try {
      await fs.unlink(this.resolveStoragePath(storedPath));
    } catch (error) {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error ? (error as { code?: string }).code : undefined;

      if (errorCode !== "ENOENT") {
        throw error;
      }
    }
  }

  private storageRoot() {
    return path.resolve(process.cwd(), this.configService.get("STORAGE_PATH") ?? "storage");
  }

  private toStorageRelativePath(filePath: string) {
    const storageRoot = this.storageRoot();
    const absoluteFilePath = path.resolve(filePath);
    const relativePath = path.relative(storageRoot, absoluteFilePath);

    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new NotFoundException("The uploaded file was stored outside the managed storage directory.");
    }

    return relativePath.replaceAll("\\", "/");
  }

  private resolveStoragePath(storedPath: string) {
    const storageRoot = this.storageRoot();
    const normalizedPath = storedPath.replaceAll("\\", "/");
    const absolutePath = path.isAbsolute(normalizedPath)
      ? path.resolve(normalizedPath)
      : path.resolve(storageRoot, normalizedPath);
    const storagePrefix = `${storageRoot}${path.sep}`;

    if (absolutePath !== storageRoot && !absolutePath.startsWith(storagePrefix)) {
      throw new NotFoundException("The requested file path is invalid.");
    }

    return absolutePath;
  }
}
