import { readFile, unlink } from "node:fs/promises";
import { BadRequestException } from "@nestjs/common";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function validateFileContent(file: Express.Multer.File): Promise<void> {
  // file-type is ESM-only; dynamic import required under CommonJS
  const fileType = await (Function('return import("file-type")')() as Promise<{ fileTypeFromBuffer: (buf: Uint8Array) => Promise<{ mime: string; ext: string } | undefined> }>);
  const buffer = await readFile(file.path);
  const detected = await fileType.fileTypeFromBuffer(buffer);

  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    await unlink(file.path).catch(() => {});
    throw new BadRequestException(
      `File content does not match an allowed type. Detected: ${detected?.mime ?? "unknown"}. Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`,
    );
  }
}
