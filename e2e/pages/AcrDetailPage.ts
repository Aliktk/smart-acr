import type { Locator, Page } from "@playwright/test";

export class AcrDetailPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly statusChip: Locator;
  readonly workflowSteps: Locator;
  readonly submitToReportingButton: Locator;
  readonly forwardToCsoButton: Locator;
  readonly submitToSecretBranchButton: Locator;
  readonly returnToClerkButton: Locator;
  readonly saveFormButton: Locator;
  readonly exportPdfButton: Locator;
  readonly adverseRemarksPanel: Locator;
  readonly timeline: Locator;
  readonly formReplica: Locator;
  readonly actionError: Locator;
  readonly successToast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1").first();
    this.statusChip = page.locator('[class*="status-chip"], [class*="StatusChip"]').first();
    this.workflowSteps = page.locator('[class*="step"]');
    this.submitToReportingButton = page.getByRole("button", { name: /submit.*reporting/i });
    this.forwardToCsoButton = page.getByRole("button", { name: /forward.*countersign/i });
    this.submitToSecretBranchButton = page.getByRole("button", { name: /submit.*secret/i });
    this.returnToClerkButton = page.getByRole("button", { name: /return.*clerk/i });
    this.saveFormButton = page.getByRole("button", { name: /save.*form|save.*changes/i });
    this.exportPdfButton = page.getByRole("button", { name: /export.*pdf|download.*pdf/i });
    this.adverseRemarksPanel = page.getByText(/adverse remarks/i).first();
    this.timeline = page.locator('[class*="timeline"], [class*="Timeline"]');
    this.formReplica = page.locator("#digital-form-replica");
    this.actionError = page.locator('[class*="danger"]').filter({ hasText: /.+/ });
    this.successToast = page.locator('[class*="success"]').filter({ hasText: /.+/ });
  }

  async goto(acrId: string) {
    await this.page.goto(`/acr/${acrId}`);
    await this.page.waitForLoadState("networkidle");
  }

  async getStatus(): Promise<string> {
    return (await this.statusChip.textContent()) ?? "";
  }
}
