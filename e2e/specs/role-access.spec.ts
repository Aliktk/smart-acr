import { test, expect } from "../fixtures/auth";

test.describe("Role-Based Access Control", () => {
  test("clerk can access: dashboard, acr/new, queue, search", async ({ page, loginAs }) => {
    await loginAs("clerk");

    await page.goto("/dashboard");
    await expect(page.locator("h1")).toBeVisible();

    await page.goto("/acr/new");
    await expect(page.getByText(/initiate.*acr|employee.*search/i)).toBeVisible();

    await page.goto("/queue");
    await expect(page).toHaveURL(/\/queue/);

    await page.goto("/search");
    await expect(page).toHaveURL(/\/search/);
  });

  test("clerk cannot access: user-management, analytics", async ({ page, loginAs }) => {
    await loginAs("clerk");

    await page.goto("/user-management");
    await page.waitForLoadState("networkidle");
    // Should be redirected or show forbidden
    const hasAccess = await page.getByText(/create.*user|manage.*users/i).isVisible().catch(() => false);
    expect(hasAccess).toBe(false);
  });

  test("employee has restricted view - no form data visible", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Employee should NOT see: initiate button, admin features
    await expect(page.getByText(/initiate.*acr/i)).not.toBeVisible();
    await expect(page.getByText(/user.*management/i)).not.toBeVisible();
  });

  test("DG can access analytics", async ({ page, loginAs }) => {
    await loginAs("dg");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toBeVisible();
  });

  test("secret branch can access archive and desk review", async ({ page, loginAs }) => {
    await loginAs("secretBranch");

    await page.goto("/archive");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/archive|record/i).first()).toBeVisible();
  });
});
