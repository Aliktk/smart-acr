import { BadRequestException } from "@nestjs/common";
import { PROFILE_IMAGE_MAX_BYTES, isSupportedProfileImageMimeType, validateProfileImageUpload } from "./upload.constants";

describe("upload.constants", () => {
  it("accepts supported JPG/PNG/WEBP image types", () => {
    expect(isSupportedProfileImageMimeType("image/jpeg")).toBe(true);
    expect(isSupportedProfileImageMimeType("image/png")).toBe(true);
    expect(isSupportedProfileImageMimeType("image/webp")).toBe(true);
  });

  it("rejects unsupported MIME types", () => {
    expect(isSupportedProfileImageMimeType("application/pdf")).toBe(false);
    expect(() =>
      validateProfileImageUpload({
        mimetype: "application/pdf",
        size: 1024,
      } as Express.Multer.File),
    ).toThrow(BadRequestException);
  });

  it("rejects files larger than the configured 2 MB limit", () => {
    expect(PROFILE_IMAGE_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(() =>
      validateProfileImageUpload({
        mimetype: "image/png",
        size: PROFILE_IMAGE_MAX_BYTES + 1,
      } as Express.Multer.File),
    ).toThrow(BadRequestException);
  });
});
