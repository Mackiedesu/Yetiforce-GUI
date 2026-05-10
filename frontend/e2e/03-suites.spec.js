import { test, expect } from '@playwright/test';
import { login, navTo } from './helpers.js';

const TS = Date.now();

test.describe('Test Suites', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'Test Suites');
  });

  test('suites page renders with project selector', async ({ page }) => {
    await expect(page.locator('h2:has-text("Test Suite Management")')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
    await expect(page.locator('label:has-text("Project")')).toBeVisible();
  });

  test('project selector shows available projects', async ({ page }) => {
    const options = page.locator('select option');
    // At least the placeholder option exists (options inside select are not visible per browser rules)
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('selecting a project loads its suites', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').allInnerTexts();
    const realOption = options.find((o) => !o.includes('--'));
    if (!realOption) {
      test.skip(); // No projects available
      return;
    }
    await select.selectOption({ label: realOption });
    await page.waitForTimeout(800);
    // Suite list or empty state visible
    await expect(
      page.locator('.object-items, .empty-state, h3:has-text("Tạo Suite mới")').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('create a new suite', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').allInnerTexts();
    const realOption = options.find((o) => !o.includes('--'));
    if (!realOption) { test.skip(); return; }

    await select.selectOption({ label: realOption });
    await page.waitForTimeout(500);

    const suiteName = `Suite E2E ${TS}`;
    await page.fill('input[placeholder*="Smoke Test Suite"]', suiteName);
    await page.click('button:has-text("Tạo Suite")');

    await expect(page.locator(`.object-item-name:has-text("${suiteName}")`)).toBeVisible({ timeout: 8000 });
  });

  test('select suite and see detail panel', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').allInnerTexts();
    const realOption = options.find((o) => !o.includes('--'));
    if (!realOption) { test.skip(); return; }

    await select.selectOption({ label: realOption });
    await page.waitForTimeout(500);

    const suiteItem = page.locator('.object-item').first();
    if (!(await suiteItem.isVisible())) { test.skip(); return; }
    await suiteItem.click();

    await expect(page.locator('h3:has-text("Chi tiết Suite")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Cập nhật Suite")')).toBeVisible();
    await expect(page.locator('button:has-text("Xóa Suite")')).toBeVisible();
  });

  test('add an inline test case to a suite', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').allInnerTexts();
    const realOption = options.find((o) => !o.includes('--'));
    if (!realOption) { test.skip(); return; }

    await select.selectOption({ label: realOption });
    await page.waitForTimeout(500);

    // Create a suite first
    const suiteName = `Suite TC Test ${TS}`;
    await page.fill('input[placeholder*="Smoke Test Suite"]', suiteName);
    await page.click('button:has-text("Tạo Suite")');
    await page.click(`.object-item:has-text("${suiteName}")`);
    // Wait for selectSuite API to finish: suite name is pre-filled in the form
    await expect(page.locator('input[placeholder*="Smoke Test Suite"]')).toHaveValue(suiteName, { timeout: 5000 });

    // Add inline TC - use the second detail-section (TC form), first input is TC name
    const tcNameInput = page.locator('.detail-section').nth(1).locator('input.input-field').first();
    await tcNameInput.fill(`TC-E2E-${TS}`);
    await page.click('button:has-text("Thêm Test Case")');

    // TC should appear in execution order list
    await expect(page.locator(`strong:has-text("TC-E2E-${TS}")`)).toBeVisible({ timeout: 8000 });
  });

  test('delete a suite', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').allInnerTexts();
    const realOption = options.find((o) => !o.includes('--'));
    if (!realOption) { test.skip(); return; }

    await select.selectOption({ label: realOption });
    await page.waitForTimeout(500);

    const tempSuiteName = `Del Suite ${TS}`;
    await page.fill('input[placeholder*="Smoke Test Suite"]', tempSuiteName);
    await page.click('button:has-text("Tạo Suite")');
    await expect(page.locator(`.object-item-name:has-text("${tempSuiteName}")`)).toBeVisible({ timeout: 8000 });

    await page.click(`.object-item:has-text("${tempSuiteName}")`);
    await page.click('button:has-text("Xóa Suite")');

    await expect(page.locator(`.object-item-name:has-text("${tempSuiteName}")`)).not.toBeVisible({ timeout: 8000 });
  });
});
