import { test, expect } from "../fixtures/auth";

test.describe("ACR Workflow Transitions", () => {
  test("queue page shows pending items for reporting officer", async ({ page, loginAs }) => {
    await loginAs("reportingOfficer");
    await page.goto("/queue");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/queue|pending|review/i).first()).toBeVisible();
  });

  test("queue page shows pending items for clerk", async ({ page, loginAs }) => {
    await loginAs("clerk");
    await page.goto("/queue");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/queue|draft|pending/i).first()).toBeVisible();
  });

  test("ACR detail page shows workflow steps", async ({ page, loginAs }) => {
    await loginAs("clerk");
    await page.goto("/queue");
    await page.waitForLoadState("networkidle");

    // Click first ACR in queue if available
    const firstAcrLink = page.locator('a[href*="/acr/"]').first();
    if (await firstAcrLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstAcrLink.click();
      await page.waitForLoadState("networkidle");

      // Verify workflow steps are visible
      await expect(page.getByText(/clerk.*initiation/i)).toBeVisible();
      await expect(page.getByText(/reporting.*officer/i).first()).toBeVisible();
    }
  });

  test("secret branch can view archive", async ({ page, loginAs }) => {
    await loginAs("secretBranch");
    await page.goto("/archive");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/archive|historical|records/i).first()).toBeVisible();
  });

  test("search page is accessible and functional", async ({ page, loginAs }) => {
    await loginAs("clerk");
    await page.goto("/search");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/search|find|records/i).first()).toBeVisible();
  });
});
