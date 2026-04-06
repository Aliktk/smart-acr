import { access, readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const candidates = [
    path.resolve(process.cwd(), "file_logo.svg"),
    path.resolve(process.cwd(), "..", "file_logo.svg"),
  ];

  let filePath: string | null = null;
  for (const candidate of candidates) {
    try {
      await access(candidate);
      filePath = candidate;
      break;
    } catch {
      // Try the next known project-root candidate.
    }
  }

  if (!filePath) {
    return new Response("FIA logo asset was not found.", { status: 404 });
  }

  const svg = await readFile(filePath, "utf8");

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
