import { test, expect } from "@playwright/test";

test.describe("public auth surface", () => {
  test("login page renders the brand experience", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome!" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("wrong password shows the generic error (no enumeration)", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email" }).fill("nobody@eiden-group.com");
    await page.getByRole("textbox", { name: "Password" }).fill("definitely-wrong-password-1");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("#login-error")).toContainText("Invalid email or password");
  });

  test("forgot password → sent state (neutral response)", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("textbox", { name: "Email" }).fill("nobody@eiden-group.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  });

  test("back to website link points at eiden-group.com", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /Back to website/i })).toHaveAttribute(
      "href",
      "https://eiden-group.com",
    );
  });
});
