import { expect, test } from "@playwright/test";

test("Reporting AI Assistant shows related questions after a reply", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /AI Assistant/i }).click();
  await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();
  await page.getByRole("button", { name: "How does this quarter compare to last?" }).click();
  await expect(page.getByText(/Income is up versus last quarter/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Related questions")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /What's driving the income increase\?/i }),
  ).toBeVisible();
});
