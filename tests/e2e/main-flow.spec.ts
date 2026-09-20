import { test, expect } from "@playwright/test";

test("main flow: one-click screen from natural language", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("intent-input").fill("经营改善、估值合理、走势相对稳定");
  await page.getByTestId("btn-screen").click();
  await expect(page.getByTestId("condition-editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("results-table")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("impact-note")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("result-row").first().click();
  await expect(page.getByTestId("explain-card")).toContainText(/来源|时点|口径/);
  await expect(page.getByTestId("disclaimer")).toBeVisible();
});
