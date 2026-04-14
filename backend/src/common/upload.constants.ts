import { BadRequestException } from "@nestjs/common";

export const PROFILE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export function isSupportedProfileImageMimeType(mimeType: string) {
  return PROFILE_IMAGE_MIME_TYPES.includes(mimeType as (typeof PROFILE_IMAGE_MIME_TYPES)[number]);
}

export function validateProfileImageUpload(file: Pick<Express.Multer.File, "mimetype" | "size">) {
  if (!isSupportedProfileImageMimeType(file.mimetype)) {
    throw new BadRequestException("Please upload a JPG, PNG, or WEBP image.");
  }

  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    throw new BadRequestException("Image uploads must be 2 MB or smaller.");
  }
}
