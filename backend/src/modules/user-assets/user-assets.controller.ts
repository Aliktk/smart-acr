import { BadRequestException, Controller, Delete, Get, Ip, Param, ParseEnumPipe, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import type { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { UserAssetType } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { PROFILE_IMAGE_MAX_BYTES, isSupportedProfileImageMimeType } from "../../common/upload.constants";
import { UserAssetsService } from "./user-assets.service";

@Controller("user-assets")
@UseGuards(JwtAuthGuard)
export class UserAssetsController {
  constructor(private readonly userAssetsService: UserAssetsService) {}

  @Get(":id/content")
  async getAssetContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("acrId") acrId: string | undefined,
    @Res() response: Response,
  ) {
    const file = await this.userAssetsService.resolveAssetContentForUser(user.id, user.activeRole, id, acrId);
    response.setHeader("Cache-Control", "private, max-age=300");
    response.contentType(file.mimeType);
    return response.sendFile(file.absolutePath);
  }

  @Post("me/:assetType")
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
  uploadCurrentUserAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Param("assetType", new ParseEnumPipe(UserAssetType)) assetType: UserAssetType,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Ip() ipAddress?: string,
  ) {
    return this.userAssetsService.upsertCurrentUserAsset(user.id, user.activeRole, assetType, file, ipAddress);
  }

  @Delete("me/:assetType")
  removeCurrentUserAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Param("assetType", new ParseEnumPipe(UserAssetType)) assetType: UserAssetType,
    @Ip() ipAddress?: string,
  ) {
    return this.userAssetsService.removeCurrentUserAsset(user.id, user.activeRole, assetType, ipAddress);
  }
}
