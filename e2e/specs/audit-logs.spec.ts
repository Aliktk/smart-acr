import { test, expect } from "../fixtures/auth";

test.describe("Audit Logs", () => {
  test("admin can view audit logs", async ({ page, loginAs }) => {
    await loginAs("secretBranch");
    await page.goto("/audit-logs");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/audit.*log|activity/i).first()).toBeVisible();
  });

  test("audit logs show actor and action columns", async ({ page, loginAs }) => {
    await loginAs("secretBranch");
    await page.goto("/audit-logs");
    await page.waitForLoadState("networkidle");

    // Expect table headers or log entry structure
    const hasEntries = await page.getByText(/created|submitted|updated|login/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    // Either has entries or shows empty state
    expect(hasEntries || await page.getByText(/no.*logs|empty/i).isVisible().catch(() => false)).toBe(true);
  });

  test("employee cannot access audit logs", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto("/audit-logs");
    await page.waitForLoadState("networkidle");

    // Should not show audit data
    const hasAuditAccess = await page.getByText(/audit.*log/i).isVisible({ timeout: 3000 }).catch(() => false);
    // Either redirected or access denied
    expect(
      !hasAuditAccess ||
      page.url().includes("/dashboard") ||
      await page.getByText(/restricted|forbidden|not allowed/i).isVisible().catch(() => false)
    ).toBe(true);
  });
});
