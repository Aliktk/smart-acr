import type { Locator, Page } from "@playwright/test";

export class AcrCreationPage {
  readonly page: Page;
  readonly employeeSearchInput: Locator;
  readonly employeeCards: Locator;
  readonly manualAddButton: Locator;
  readonly nextStepButton: Locator;
  readonly prevStepButton: Locator;
  readonly saveDraftButton: Locator;
  readonly submitButton: Locator;
  readonly validationError: Locator;
  readonly periodFromInput: Locator;
  readonly periodToInput: Locator;
  readonly stepIndicators: Locator;

  constructor(page: Page) {
    this.page = page;
    this.employeeSearchInput = page.getByLabel(/search employee/i);
    this.employeeCards = page.locator("button").filter({ hasText: /BPS-/ });
    this.manualAddButton = page.getByRole("button", { name: /add employee manually/i });
    this.nextStepButton = page.getByRole("button", { name: /next|continue|step/i }).last();
    this.prevStepButton = page.getByRole("button", { name: /back|previous/i });
    this.saveDraftButton = page.getByRole("button", { name: /save.*draft/i });
    this.submitButton = page.getByRole("button", { name: /submit.*reporting/i });
    this.validationError = page.locator('[class*="danger"], [class*="red-"]').filter({ hasText: /.+/ });
    this.periodFromInput = page.locator('input[type="date"]').first();
    this.periodToInput = page.locator('input[type="date"]').last();
    this.stepIndicators = page.locator('[class*="rounded-full"]').filter({ hasText: /^[123]$/ });
  }

  async goto() {
    await this.page.goto("/acr/new");
    await this.page.waitForLoadState("networkidle");
  }

  async searchEmployee(query: string) {
    await this.employeeSearchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounced search
    await this.page.waitForLoadState("networkidle");
  }

  async selectFirstEmployee() {
    await this.employeeCards.first().click();
  }

  async setReportingPeriod(from: string, to: string) {
    await this.periodFromInput.fill(from);
    await this.periodToInput.fill(to);
  }
}
