import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as fs from "node:fs";
import * as path from "node:path";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { validateFileContent } from "../../helpers/file-validation";
import { ArchiveService } from "./archive.service";
import { CreateHistoricalArchiveDto } from "./dto/create-historical-archive.dto";
import { ListArchiveRecordsDto } from "./dto/list-archive-records.dto";
import { UpdateHistoricalArchiveDto } from "./dto/update-historical-archive.dto";
import { VerifyArchiveRecordDto } from "./dto/verify-archive-record.dto";

@Controller("archive")
@UseGuards(JwtAuthGuard)
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Get()
  listLegacy(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListArchiveRecordsDto,
  ) {
    return this.archiveService.list(user.id, user.activeRole, query);
  }

  @Get("records")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListArchiveRecordsDto,
  ) {
    return this.archiveService.list(user.id, user.activeRole, query);
  }

  @Get("records/:id")
  detail(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.archiveService.detail(user.id, user.activeRole, id);
  }

  @Post("historical")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const destination = path.join(process.cwd(), process.env.STORAGE_PATH ?? "storage", "archive-history");
          fs.mkdirSync(destination, { recursive: true });
          callback(null, destination);
        },
        filename: (_request, file, callback) => {
          callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-")}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (_request, file, callback) => {
        callback(null, file.mimetype === "application/pdf");
      },
    }),
  )
  async uploadHistorical(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateHistoricalArchiveDto,
    @UploadedFile() file?: Express.Multer.File,
    @Ip() ipAddress?: string,
  ) {
    if (file) {
      await validateFileContent(file);
    }

    return this.archiveService.uploadHistorical(user.id, user.activeRole, dto, file, ipAddress);
  }

  @Patch("historical/:id/metadata")
  updateHistoricalMetadata(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateHistoricalArchiveDto,
    @Ip() ipAddress: string,
  ) {
    return this.archiveService.updateHistoricalMetadata(user.id, user.activeRole, id, dto, ipAddress);
  }

  @Post("historical/:id/verify")
  verifyHistorical(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: VerifyArchiveRecordDto,
    @Ip() ipAddress: string,
  ) {
    return this.archiveService.verifyHistorical(user.id, user.activeRole, id, dto.remarks, ipAddress);
  }

  @Delete("historical/:id")
  deleteHistorical(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Ip() ipAddress: string,
  ) {
    return this.archiveService.deleteHistorical(user.id, user.activeRole, id, ipAddress);
  }
}
