import { test, expect } from "@playwright/test";

const sampleInput = `SOL/USDT Spot Limit Sell 720.700000 USDT 144.14 USDT 5.0000 SOL
0.720700000000 USDT
2026-01-16 22:34:02 16943102 69540352
SOL/USDT Spot Limit Buy 317.457390 USDT 144.05 USDT 2.2038 SOL
0.317457390000 USDT
2026-01-16 22:33:20 16942414 56325120`;

const olderInput = `SOL/USDT Spot Limit Buy 1459.600000 USDT 145.96 USDT 10.0000 SOL
0.010000000000 SOL
2026-01-15 01:39:57 14498726 88640000`;

const tableInput = `Spot Pairs\tOrder Type\tDirection\tfeeCoin\tExecFeeV2\tFilled Value\tFilled Price\tFilled Quantity\tFees\tTransaction ID\tOrder No.\tTimestamp (UTC)
SOLUSDT\tLIMIT\tSELL\tUSDT\t0.7207\t720.7\t144.14\t5\t0.7207\t2.21E+18\t69540352\t1/16/2026 19:34
SOLUSDT\tLIMIT\tBUY\tSOL\t0.02\t2837.2\t141.86\t20\t0.02\t2.21E+18\t70246656\t1/15/2026 18:40`;

const headerlessInput = `SOLUSDT\tUSDT\t0.7207\t{"USDT":"0.7207"}\tLIMIT\tSELL\t720.7\t144.14\t144.14\t5\t720.7\tFILLED\t69540352
SOLUSDT\tSOL\t0.02\t{"SOL":"0.02"}\tLIMIT\tBUY\t2837.2\t141.86\t141.86\t20\t2837.2\tFILLED\t70246656`;

const blockInput = `SOL/USDT Spot Limit Buy 1,436.600000 USDT
143.66/143.66 USDT
10.0000 / 10.0000 SOL
--
1,436.600000 USDT
Filled
2026-01-17 17:39:10 16831744
SOL/USDT Spot Limit Sell 720.700000 USDT
144.14/144.14 USDT
5.0000 / 5.0000 SOL
--
720.700000 USDT
Filled
2026-01-16 22:34:00 69540352`;

const shortBlockInput = `SOL/USDT\tSpot\tLimit\tBuy\t1,459.600000 USDT
145.96/145.96 USDT
10.0000 / 10.0000 SOL
--
1,459.600000 USDT
Filled
2026-01-12 20:52:07 88640000`;

const verticalInput = `SOL/USDT
Spot
Limit
Buy
1,436.600000 USDT
143.66
10.0000  SOL
Trade
0.01  SOL

2026-01-18 01:36:31
17832426
--
--`;

test("загрузка истории и фильтрация", async ({ page }) => {
  await page.goto("/");

  await page.getByPlaceholder("Вставьте сюда историю торгов...").fill(sampleInput);
  await page.getByRole("button", { name: "Обработать" }).click();

  await expect(page.getByRole("cell", { name: "SOL/USDT" }).first()).toBeVisible();

  await page.getByRole("combobox", { name: "Сторона" }).selectOption("Buy");
  await expect(page.getByRole("cell", { name: "Buy" })).toBeVisible();
});

test("мерджит сделки без дублей", async ({ page }) => {
  await page.goto("/");

  const textarea = page.getByPlaceholder("Вставьте сюда историю торгов...");
  await textarea.fill(sampleInput);
  await page.getByRole("button", { name: "Обработать" }).click();

  await expect(page.locator("table tbody tr")).toHaveCount(2);

  await textarea.fill(olderInput);
  await page.getByRole("button", { name: "Обработать" }).click();

  await expect(page.locator("table tbody tr")).toHaveCount(3);
});

test("поддерживает табличный формат", async ({ page }) => {
  await page.goto("/");

  const textarea = page.getByPlaceholder("Вставьте сюда историю торгов...");
  await textarea.fill(tableInput);
  await page.getByRole("button", { name: "Обработать" }).click();

  await expect(page.locator("table tbody tr")).toHaveCount(2);
  await expect(
    page.getByRole("cell", { name: "SOL/USDT" }).first(),
  ).toBeVisible();
});

test("поддерживает формат без заголовка", async ({ page }) => {
  await page.goto("/");

  const textarea = page.getByPlaceholder("Вставьте сюда историю торгов...");
  await textarea.fill(headerlessInput);
  await page.getByRole("button", { name: "Обработать" }).click();

  await expect(page.locator("table tbody tr")).toHaveCount(2);
});

test("поддерживает блочный формат", async ({ page }) => {
  await page.goto("/");

  const textarea = page.getByPlaceholder("Вставьте сюда историю торгов...");
  await textarea.fill(blockInput);
  await page.getByRole("button", { name: "Обработать" }).click();

  await expect(page.locator("table tbody tr")).toHaveCount(2);
});

test("поддерживает короткий блочный формат", async ({ page }) => {
  await page.goto("/");

  const textarea = page.getByPlaceholder("Вставьте сюда историю торгов...");
  await textarea.fill(shortBlockInput);
  await page.getByRole("button", { name: "Обработать" }).click();

  await expect(page.locator("table tbody tr")).toHaveCount(1);
});

test("поддерживает вертикальный формат", async ({ page }) => {
  await page.goto("/");

  const textarea = page.getByPlaceholder("Вставьте сюда историю торгов...");
  await textarea.fill(verticalInput);
  await page.getByRole("button", { name: "Обработать" }).click();

  await expect(page.locator("table tbody tr")).toHaveCount(1);
});
