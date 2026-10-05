import { expect, test } from "@playwright/test";

test("Reporting AI Assistant answers, then related questions fail to load", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /AI Assistant/i }).click();
  await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();
  await page.getByRole("button", { name: "How does this quarter compare to last?" }).click();
  await expect(page.getByText(/Income is up versus last quarter|quarter/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("alert")).toContainText(/Related questions failed to load/i, { timeout: 10_000 });
});
