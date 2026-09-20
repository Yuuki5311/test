import { test, expect } from "@playwright/test";

test("main flow: intent → conditions → results → explanation", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("intent-input").fill("经营改善、估值合理、走势相对稳定");
  await page.getByTestId("btn-clarify").click();
  await expect(page.getByTestId("clarify-panel")).toBeVisible();
  await page.getByTestId("btn-parse").click();
  await expect(page.getByTestId("condition-editor")).toBeVisible();
  await page.getByTestId("btn-screen").click();
  await expect(page.getByTestId("results-table")).toBeVisible();
  await page.getByTestId("result-row").first().click();
  await expect(page.getByTestId("explain-card")).toContainText(/来源|时点|口径/);
  await expect(page.getByTestId("disclaimer")).toBeVisible();
});
