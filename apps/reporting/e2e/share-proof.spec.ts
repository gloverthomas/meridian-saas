import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const proofDir = join(process.cwd(), "e2e/proof");

test("Reporting Share copies a deep link without credentials (MER-4 proof)", async ({ page, context }) => {
  mkdirSync(proofDir, { recursive: true });
  let signalPosts = 0;
  await page.route("**/signal", (route) => {
    if (route.request().method() === "POST") {
      signalPosts += 1;
    }
    void route.fulfill({ status: 204, body: "" });
  });

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/#profit-loss");
  await page.getByRole("button", { name: /^Share$/i }).click();

  await expect(page.getByText(/Share failed/i)).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(/Report link copied/i);

  const clipboardText = await page.evaluate(async () => navigator.clipboard.readText());
  expect(clipboardText).toMatch(/localhost:3001.*#profit-loss/);
  expect(clipboardText).not.toMatch(/Bearer|MERIDIAN_BFF|\/api\//i);
  expect(signalPosts).toBe(0);

  await page.screenshot({ path: join(proofDir, "mer-4-reporting-share-success.png"), fullPage: false });
});
