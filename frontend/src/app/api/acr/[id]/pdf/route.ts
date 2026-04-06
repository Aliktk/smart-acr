import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROME_EXECUTABLE_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter((value): value is string => Boolean(value));

  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolved) {
    throw new Error("No supported Chromium browser executable was found for PDF export.");
  }

  return resolved;
}

function sanitizeFileName(value: string, fallback: string) {
  const normalized = value.replace(/[\\/:*?\"<>|]+/g, "-").trim();
  return normalized.length > 0 ? normalized : fallback;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const origin = new URL(request.url).origin;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const browser = await chromium.launch({
    executablePath: resolveBrowserExecutable(),
    headless: true,
    args: ["--disable-gpu", "--font-render-hinting=medium"],
  });

  try {
    const page = await browser.newPage({
      extraHTTPHeaders: cookieHeader ? { cookie: cookieHeader } : undefined,
    });

    await page.goto(`${origin}/print/acr/${id}?ts=${Date.now()}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForFunction(
      () => document.body.dataset.pdfState === "ready" || document.body.dataset.pdfState === "error",
      undefined,
      { timeout: 45000 },
    );

    const pageState = await page.evaluate(() => ({
      state: document.body.dataset.pdfState ?? "loading",
      error: document.body.dataset.pdfError ?? "",
      fileName: document.body.dataset.pdfFilename ?? "",
    }));

    if (pageState.state === "error") {
      throw new Error(pageState.error || "Unable to prepare the requested ACR for PDF export.");
    }

    await page.emulateMedia({ media: "print" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "8mm",
        right: "6mm",
        bottom: "8mm",
        left: "6mm",
      },
    });

    const fileName = sanitizeFileName(pageState.fileName, `acr-${id}`);
    const pdfBody = new Uint8Array(pdf);

    return new Response(pdfBody, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}
