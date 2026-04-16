import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileStorageType } from "@prisma/client";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";

export type StoredObjectDescriptor = {
  storageType: FileStorageType;
  filePath: string;
  fileUrl: string | null;
  storedFileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
};

@Injectable()
export class StorageService {
  constructor(private readonly configService: ConfigService) {}

  storageRoot() {
    return path.resolve(process.cwd(), this.configService.get("STORAGE_PATH") ?? "storage");
  }

  async saveUploadedFile(
    file: Pick<Express.Multer.File, "buffer" | "originalname" | "mimetype" | "size">,
    options: {
      directory: string;
      fileNamePrefix?: string;
    },
  ): Promise<StoredObjectDescriptor> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException("The uploaded file is empty.");
    }

    const sanitizedDirectory = options.directory.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    const absoluteDirectory = path.resolve(this.storageRoot(), sanitizedDirectory);
    await fs.mkdir(absoluteDirectory, { recursive: true });

    const extension = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12);
    const baseName = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 60) || "upload";
    const prefix = options.fileNamePrefix ? `${options.fileNamePrefix.replace(/[^a-zA-Z0-9_-]/g, "-")}-` : "";
    const storedFileName = `${Date.now()}-${prefix}${randomUUID()}-${baseName}${extension}`;
    const absolutePath = path.resolve(absoluteDirectory, storedFileName);

    await fs.writeFile(absolutePath, file.buffer);

    return {
      storageType: FileStorageType.LOCAL,
      filePath: this.toStorageRelativePath(absolutePath),
      fileUrl: null,
      storedFileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
    };
  }

  resolveStoragePath(relativePath: string) {
    const storageRoot = this.storageRoot();
    const normalizedPath = relativePath.replaceAll("\\", "/");
    const absolutePath = path.isAbsolute(normalizedPath)
      ? path.resolve(normalizedPath)
      : path.resolve(storageRoot, normalizedPath);
    const storagePrefix = `${storageRoot}${path.sep}`;

    if (absolutePath !== storageRoot && !absolutePath.startsWith(storagePrefix)) {
      throw new NotFoundException("The requested file path is invalid.");
    }

    return absolutePath;
  }

  async assertReadable(relativePath: string) {
    const absolutePath = this.resolveStoragePath(relativePath);

    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException("The requested file is no longer available in storage.");
    }

    return absolutePath;
  }

  async deleteStoredFile(relativePath?: string | null) {
    if (!relativePath) {
      return;
    }

    try {
      await fs.unlink(this.resolveStoragePath(relativePath));
    } catch (error) {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error ? (error as { code?: string }).code : undefined;

      if (errorCode !== "ENOENT") {
        throw error;
      }
    }
  }

  private toStorageRelativePath(filePath: string) {
    const storageRoot = this.storageRoot();
    const absoluteFilePath = path.resolve(filePath);
    const relativePath = path.relative(storageRoot, absoluteFilePath);

    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new BadRequestException("The uploaded file was stored outside the managed storage directory.");
    }

    return relativePath.replaceAll("\\", "/");
  }
}
