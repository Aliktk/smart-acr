import type { Locator, Page } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.getByPlaceholder(/email|username|badge/i);
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.getByRole("button", { name: /sign in|login|continue/i });
    this.errorMessage = page.locator('[class*="danger"], [class*="error"], [class*="red"]').first();
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
