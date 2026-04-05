import { Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import type { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as fs from "node:fs";
import * as path from "node:path";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { FilesService } from "./files.service";

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
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Query("kind") kind = "DOCUMENT",
    @Query("acrRecordId") acrRecordId?: string,
  ) {
    return this.filesService.recordFile(user.id, acrRecordId, kind as "SIGNATURE" | "STAMP" | "DOCUMENT", file);
  }

  @Get(":id/content")
  async getFileContent(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Res() response: Response) {
    const file = await this.filesService.resolveFileForUser(user.id, user.activeRole, id);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.contentType(file.mimeType);
    return response.sendFile(file.absolutePath);
  }
}
