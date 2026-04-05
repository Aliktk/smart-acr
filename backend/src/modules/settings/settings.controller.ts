import {
  Body,
  Controller,
  Get,
  Ip,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as fs from "node:fs";
import * as path from "node:path";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateSettingDto } from "./dto/update-setting.dto";
import { UpdateSettingsPreferencesDto } from "./dto/update-settings-preferences.dto";
import { SettingsService } from "./settings.service";

@Controller("settings")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("me")
  getUserSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getUserSettings(user.id, user.activeRole);
  }

  @Patch("profile")
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto, @Ip() ipAddress: string) {
    return this.settingsService.updateProfile(user.id, user.activeRole, dto, ipAddress);
  }

  @Post("profile/avatar")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const destination = path.join(process.cwd(), process.env.STORAGE_PATH ?? "storage", "avatars");
          fs.mkdirSync(destination, { recursive: true });
          callback(null, destination);
        },
        filename: (_request, file, callback) => {
          const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
          callback(null, `${Date.now()}-${sanitizedName}`);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
      fileFilter: (_request, file, callback) => {
        callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
      },
    }),
  )
  uploadProfileAvatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File, @Ip() ipAddress?: string) {
    return this.settingsService.updateAvatar(user.id, user.activeRole, file, ipAddress);
  }

  @Get("profile/avatar")
  async getProfileAvatar(@CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    const file = await this.settingsService.getAvatarFile(user.id);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.contentType(file.mimeType);
    return response.sendFile(file.absolutePath);
  }

  @Patch("preferences")
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSettingsPreferencesDto, @Ip() ipAddress: string) {
    return this.settingsService.updatePreferences(user.id, user.activeRole, dto, ipAddress);
  }

  @Patch("security/password")
  updatePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePasswordDto, @Ip() ipAddress: string) {
    return this.settingsService.updatePassword(user.id, user.activeRole, dto, ipAddress);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_OPS)
  list() {
    return this.settingsService.list();
  }

  @Patch()
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_OPS)
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSettingDto, @Ip() ipAddress: string) {
    return this.settingsService.update(user.id, dto.key, dto.value, ipAddress);
  }
}
