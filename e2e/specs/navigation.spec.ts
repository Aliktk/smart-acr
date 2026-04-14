import { test, expect } from "../fixtures/auth";

test.describe("Navigation & Layout", () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs("clerk");
  });

  test("sidebar navigation works", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Check sidebar links exist
    const sidebar = page.locator("nav, aside, [class*='sidebar']").first();
    await expect(sidebar).toBeVisible();

    // Navigate to queue
    const queueLink = page.getByRole("link", { name: /queue/i });
    if (await queueLink.isVisible()) {
      await queueLink.click();
      await expect(page).toHaveURL(/\/queue/);
    }
  });

  test("page title updates on navigation", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1").first()).toBeVisible();

    await page.goto("/search");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("notification panel is accessible", async ({ page }) => {
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/notification/i).first()).toBeVisible();
  });

  test("settings page is accessible", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/settings|preferences|password/i).first()).toBeVisible();
  });

  test("help page is accessible", async ({ page }) => {
    await page.goto("/help-support");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/help|support|guide/i).first()).toBeVisible();
  });

  test("404 page for invalid routes", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await page.waitForLoadState("networkidle");

    // Should show 404 or redirect
    const is404 = await page.getByText(/not found|404/i).isVisible().catch(() => false);
    const isRedirected = page.url().includes("/dashboard") || page.url().includes("/login");
    expect(is404 || isRedirected).toBe(true);
  });
});
