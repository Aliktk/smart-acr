import { test, expect } from "../fixtures/auth";
import { DashboardPage } from "../pages/DashboardPage";

test.describe("Dashboard", () => {
  test("clerk dashboard shows initiate button and metrics", async ({ page, loginAs }) => {
    await loginAs("clerk");
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    await expect(dashboard.heading).toBeVisible();
    await expect(dashboard.initiateButton).toBeVisible();
  });

  test("reporting officer dashboard shows review queue", async ({ page, loginAs }) => {
    await loginAs("reportingOfficer");
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    await expect(dashboard.heading).toBeVisible();
    await expect(page.getByText(/review|pending|queue/i).first()).toBeVisible();
  });

  test("secret branch dashboard shows archive link", async ({ page, loginAs }) => {
    await loginAs("secretBranch");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/archive|secret.*branch|desk/i).first()).toBeVisible();
  });

  test("employee dashboard shows metadata-only view", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Employee should NOT see form data or confidential sections
    await expect(page.getByText(/service.*period|summary/i).first()).toBeVisible();
    await expect(page.getByText(/initiate.*acr/i)).not.toBeVisible();
  });

  test("dashboard loads without errors", async ({ page, loginAs }) => {
    await loginAs("clerk");
    const dashboard = new DashboardPage(page);
    await dashboard.goto();

    // No error messages visible
    const errors = page.locator('[class*="danger"], [class*="error-"]');
    await expect(errors).toHaveCount(0);
  });
});
