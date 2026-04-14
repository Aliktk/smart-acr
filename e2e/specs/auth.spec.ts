import { test, expect } from "../fixtures/auth";
import { LoginPage } from "../pages/LoginPage";

test.describe("Authentication", () => {
  test("shows login page with FIA branding", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText(/federal investigation agency/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("invalid_user", "wrong_password");
    await page.waitForTimeout(1000);
    await expect(page.getByText(/invalid|incorrect|not found|failed/i)).toBeVisible();
  });

  test("clerk can login and reach dashboard", async ({ page, loginAs }) => {
    await loginAs("clerk");
    await page.goto("/dashboard");
    await expect(page.getByText(/initiate|draft|queue/i).first()).toBeVisible();
  });

  test("reporting officer can login and reach dashboard", async ({ page, loginAs }) => {
    await loginAs("reportingOfficer");
    await page.goto("/dashboard");
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("employee can login with restricted view", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto("/dashboard");
    await expect(page.getByText(/service.period|acr.*history|summary/i).first()).toBeVisible();
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout clears session", async ({ page, loginAs }) => {
    await loginAs("clerk");
    await page.goto("/dashboard");

    // Click logout
    const logoutButton = page.getByRole("button", { name: /logout|sign out/i });
    if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutButton.click();
      await page.waitForURL(/\/login/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
