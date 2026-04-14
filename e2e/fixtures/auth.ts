import { test as base, expect, type Page } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";
const DEMO_PASSWORD = "ChangeMe@123";

export interface TestUser {
  username: string;
  password: string;
  role: string;
  displayName: string;
}

export const TEST_USERS: Record<string, TestUser> = {
  clerk: {
    username: "clerk.isb",
    password: DEMO_PASSWORD,
    role: "CLERK",
    displayName: "Zahid Ullah",
  },
  reportingOfficer: {
    username: "reporting.lhr",
    password: DEMO_PASSWORD,
    role: "REPORTING_OFFICER",
    displayName: "DSP Khalid Mehmood",
  },
  countersigningOfficer: {
    username: "countersigning.lhr",
    password: DEMO_PASSWORD,
    role: "COUNTERSIGNING_OFFICER",
    displayName: "SP Anwar Ul Haq",
  },
  secretBranch: {
    username: "secret.admin",
    password: DEMO_PASSWORD,
    role: "SECRET_BRANCH",
    displayName: "Nazia Ambreen",
  },
  dg: {
    username: "dg.portal",
    password: DEMO_PASSWORD,
    role: "DG",
    displayName: "DG FIA",
  },
  employee: {
    username: "fatima.zahra.employee",
    password: DEMO_PASSWORD,
    role: "EMPLOYEE",
    displayName: "Fatima Zahra",
  },
};

/**
 * Login via API (bypasses MFA challenge for speed) and set cookies.
 * Falls back to UI login if API direct login is available.
 */
async function loginViaApi(page: Page, user: TestUser): Promise<void> {
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { username: user.username, password: user.password },
  });

  if (response.ok()) {
    const cookies = response.headers()["set-cookie"];
    if (cookies) {
      await page.context().addCookies(
        cookies.split(",").map((raw) => {
          const parts = raw.trim().split(";")[0].split("=");
          return {
            name: parts[0].trim(),
            value: parts.slice(1).join("=").trim(),
            domain: "localhost",
            path: "/",
          };
        }),
      );
    }
    return;
  }

  // Fallback: login via UI
  await loginViaUi(page, user);
}

async function loginViaUi(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder(/email|username|badge/i).fill(user.username);
  await page.locator('input[type="password"]').fill(user.password);
  await page.getByRole("button", { name: /sign in|login|continue/i }).click();

  // Handle MFA challenge if present
  const verifyPage = page.getByText(/verification code|enter code/i);
  if (await verifyPage.isVisible({ timeout: 3000 }).catch(() => false)) {
    // In test env, code might be auto-filled or bypassed
    await page.waitForURL(/\/(dashboard|login\/role)/, { timeout: 15000 });
  }

  // Handle role selection if multi-role
  const roleSelector = page.getByText(/select.*role|choose.*role/i);
  if (await roleSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByText(new RegExp(user.role.replace(/_/g, " "), "i")).click();
    await page.getByRole("button", { name: /continue|proceed/i }).click();
  }

  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

// Extend base test with auth fixture
type AuthFixtures = {
  loginAs: (role: keyof typeof TEST_USERS) => Promise<void>;
  testUsers: typeof TEST_USERS;
};

export const test = base.extend<AuthFixtures>({
  loginAs: async ({ page }, use) => {
    const fn = async (role: keyof typeof TEST_USERS) => {
      const user = TEST_USERS[role];
      await loginViaApi(page, user);
    };
    await use(fn);
  },
  testUsers: async ({}, use) => {
    await use(TEST_USERS);
  },
});

export { expect };
