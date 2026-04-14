import {
  BadRequestException,
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
import { memoryStorage } from "multer";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { PROFILE_IMAGE_MAX_BYTES, isSupportedProfileImageMimeType } from "../../common/upload.constants";
import { UpdateEmployeeProfileDto } from "./dto/update-employee-profile.dto";
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
      storage: memoryStorage(),
      limits: {
        fileSize: PROFILE_IMAGE_MAX_BYTES,
      },
      fileFilter: (_request, file, callback) => {
        if (!isSupportedProfileImageMimeType(file.mimetype)) {
          callback(new BadRequestException("Please upload a JPG, PNG, or WEBP image.") as never, false);
          return;
        }

        callback(null, true);
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

  @Patch("employee-profile")
  updateEmployeeProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateEmployeeProfileDto, @Ip() ipAddress: string) {
    return this.settingsService.updateEmployeeProfile(user.id, user.activeRole, dto, ipAddress);
  }

  @Patch("preferences")
  updatePreferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSettingsPreferencesDto, @Ip() ipAddress: string) {
    return this.settingsService.updatePreferences(user.id, user.activeRole, dto, ipAddress);
  }

  @Patch("security/password")
  updatePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePasswordDto, @Ip() ipAddress: string) {
    return this.settingsService.updatePassword(user.id, user.activeRole, dto, ipAddress);
  }

  @Get("reference/postings")
  async referencePostings() {
    return this.settingsService.getReferencePostings();
  }

  @Get("reference/zones-circles")
  async referenceZonesCircles() {
    return this.settingsService.getReferenceZonesCircles();
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
