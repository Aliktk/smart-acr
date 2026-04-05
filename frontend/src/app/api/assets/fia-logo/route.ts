import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const filePath = path.resolve(process.cwd(), "..", "file_logo.svg");
  const svg = await readFile(filePath, "utf8");

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
