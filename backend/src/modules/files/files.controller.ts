import { BadRequestException, Controller, ForbiddenException, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import type { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as fs from "node:fs";
import * as path from "node:path";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { validateFileContent } from "../../helpers/file-validation";
import { FilesService } from "./files.service";

const ALLOWED_KINDS = ["SIGNATURE", "STAMP", "DOCUMENT"] as const;
type FileKind = (typeof ALLOWED_KINDS)[number];

@Controller("files")
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const destination = path.join(process.cwd(), process.env.STORAGE_PATH ?? "storage", "uploads");
          fs.mkdirSync(destination, { recursive: true });
          callback(null, destination);
        },
        filename: (_request, file, callback) => {
          callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-")}`);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
      fileFilter: (_request, file, callback) => {
        callback(null, ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.mimetype));
      },
    }),
  )
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Query("kind") kind = "DOCUMENT",
    @Query("acrRecordId") acrRecordId?: string,
  ) {
    if (!ALLOWED_KINDS.includes(kind as FileKind)) {
      throw new BadRequestException(`Invalid file kind "${kind}". Allowed: ${ALLOWED_KINDS.join(", ")}`);
    }

    const signatureStampRoles = ["REPORTING_OFFICER", "COUNTERSIGNING_OFFICER", "ADDITIONAL_DIRECTOR", "SUPER_ADMIN", "IT_OPS"];
    if ((kind === "SIGNATURE" || kind === "STAMP") && !signatureStampRoles.includes(user.activeRole)) {
      throw new ForbiddenException("Only officers may upload signature or stamp files");
    }

    if (!file) {
      throw new BadRequestException("Unsupported file type. Allowed types: JPEG, PNG, WebP, PDF.");
    }

    await validateFileContent(file);

    return this.filesService.recordFile(user.id, acrRecordId, kind as FileKind, file);
  }

  @Get(":id/content")
  async getFileContent(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Res() response: Response) {
    const file = await this.filesService.resolveFileForUser(user.id, user.activeRole, id);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.contentType(file.mimeType);
    return response.sendFile(file.absolutePath);
  }
}
