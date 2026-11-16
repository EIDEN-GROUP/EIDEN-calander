import { test, expect } from "@playwright/test";

/**
 * Authenticated smoke — skipped unless credentials are supplied via env.
 *   E2E_EMAIL=you@example.com E2E_PASSWORD=secret npm run e2e
 */
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill(EMAIL!);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD!);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
}

test.describe("authenticated smoke", () => {
  test.skip(!EMAIL || !PASSWORD, "set E2E_EMAIL and E2E_PASSWORD to run");

  test("login → dashboard renders live KPIs", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("heading", { name: /Good morning/ })).toBeVisible();
    await expect(page.getByText("Today's bookings")).toBeVisible();
  });

  test("calendar loads with Live indicator", async ({ page }) => {
    await signIn(page);
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  });

  test("settings team page loads for admins", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings/team");
    await expect(page.getByRole("heading", { name: "Team & Users" })).toBeVisible();
  });
});
