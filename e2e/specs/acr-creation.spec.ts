import { test, expect } from "../fixtures/auth";
import { AcrCreationPage } from "../pages/AcrCreationPage";

test.describe("ACR Creation", () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs("clerk");
  });

  test("loads ACR creation page with 3-step wizard", async ({ page }) => {
    const acrPage = new AcrCreationPage(page);
    await acrPage.goto();

    await expect(page.getByText(/step 1/i)).toBeVisible();
    await expect(page.getByText(/employee.*search/i)).toBeVisible();
    await expect(acrPage.employeeSearchInput).toBeVisible();
  });

  test("can search for employees", async ({ page }) => {
    const acrPage = new AcrCreationPage(page);
    await acrPage.goto();

    await acrPage.searchEmployee("Fatima");
    await expect(acrPage.employeeCards.first()).toBeVisible({ timeout: 5000 });
  });

  test("can select an employee and proceed to step 2", async ({ page }) => {
    const acrPage = new AcrCreationPage(page);
    await acrPage.goto();

    await acrPage.searchEmployee("Fatima");
    await acrPage.selectFirstEmployee();

    // Navigate to step 2
    const nextButton = page.getByRole("button", { name: /next|step 2|fill/i });
    if (await nextButton.isVisible()) {
      await nextButton.click();
    }

    await expect(page.getByText(/step 2|fill.*form|clerk/i)).toBeVisible({ timeout: 5000 });
  });

  test("validates minimum 3-month reporting period", async ({ page }) => {
    const acrPage = new AcrCreationPage(page);
    await acrPage.goto();

    await acrPage.searchEmployee("Fatima");
    await acrPage.selectFirstEmployee();

    // Go to step 2
    const nextButton = page.getByRole("button", { name: /next|step 2|fill/i });
    if (await nextButton.isVisible()) {
      await nextButton.click();
    }

    // Set period less than 3 months
    const year = new Date().getFullYear();
    await acrPage.setReportingPeriod(`${year}-10-01`, `${year}-11-30`);

    // Try to proceed to step 3
    const reviewButton = page.getByRole("button", { name: /next|step 3|review/i });
    if (await reviewButton.isVisible()) {
      await reviewButton.click();
    }

    // Expect validation error
    await expect(page.getByText(/three.*month|3.*month|minimum/i)).toBeVisible({ timeout: 3000 });
  });

  test("validates calendar year boundary", async ({ page }) => {
    const acrPage = new AcrCreationPage(page);
    await acrPage.goto();

    await acrPage.searchEmployee("Fatima");
    await acrPage.selectFirstEmployee();

    const nextButton = page.getByRole("button", { name: /next|step 2|fill/i });
    if (await nextButton.isVisible()) {
      await nextButton.click();
    }

    // Set cross-year period
    await acrPage.setReportingPeriod("2025-07-01", "2026-06-30");

    const reviewButton = page.getByRole("button", { name: /next|step 3|review/i });
    if (await reviewButton.isVisible()) {
      await reviewButton.click();
    }

    await expect(page.getByText(/calendar year|single.*year/i)).toBeVisible({ timeout: 3000 });
  });

  test("defaults to current calendar year period", async ({ page }) => {
    const acrPage = new AcrCreationPage(page);
    await acrPage.goto();

    await acrPage.searchEmployee("Fatima");
    await acrPage.selectFirstEmployee();

    const nextButton = page.getByRole("button", { name: /next|step 2|fill/i });
    if (await nextButton.isVisible()) {
      await nextButton.click();
    }

    const year = new Date().getFullYear();
    await expect(acrPage.periodFromInput).toHaveValue(`${year}-01-01`);
    await expect(acrPage.periodToInput).toHaveValue(`${year}-12-31`);
  });

  test("manual add mode shows form fields", async ({ page }) => {
    const acrPage = new AcrCreationPage(page);
    await acrPage.goto();

    await acrPage.manualAddButton.click();
    await expect(page.getByText(/full name/i)).toBeVisible();
    await expect(page.getByText(/CNIC/i).first()).toBeVisible();
    await expect(page.getByText(/form family/i)).toBeVisible();
  });

  test("non-clerk role cannot access creation page", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto("/acr/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/restricted|not allowed|clerk/i)).toBeVisible();
  });
});
