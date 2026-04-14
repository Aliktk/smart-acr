import type { Locator, Page } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly statCards: Locator;
  readonly initiateButton: Locator;
  readonly queueItems: Locator;
  readonly retirementWarnings: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1").first();
    this.statCards = page.locator('[data-testid="stat-card"], [class*="stat-card"]');
    this.initiateButton = page.getByRole("link", { name: /initiate.*acr|new.*acr/i });
    this.queueItems = page.locator('[data-testid="queue-item"], [class*="queue-item"]');
    this.retirementWarnings = page.getByText(/retirement.*pending/i);
  }

  async goto() {
    await this.page.goto("/dashboard");
    await this.page.waitForLoadState("networkidle");
  }

  async getMetricValue(label: string): Promise<string> {
    const card = this.page.locator(`text=${label}`).locator("..").locator("..");
    return (await card.locator('[class*="text-2xl"], [class*="text-3xl"]').textContent()) ?? "0";
  }
}
