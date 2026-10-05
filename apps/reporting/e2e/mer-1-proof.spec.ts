import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const proofDir = join(process.cwd(), "e2e/proof");

test("MER-1: Reporting AI Assistant sends chat and receives a fixture reply", async ({ page }) => {
  mkdirSync(proofDir, { recursive: true });
  await page.goto("/");
  await page.getByRole("button", { name: /AI Assistant/i }).click();
  await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();
  await page.getByRole("button", { name: "How does this quarter compare to last?" }).click();
  await expect(page.getByText(/Income is up versus last quarter/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("table")).toBeVisible();
  await page.screenshot({ path: join(proofDir, "mer-1-fix.png"), fullPage: false });
});
