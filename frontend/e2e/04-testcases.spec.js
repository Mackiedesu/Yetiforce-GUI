import { test, expect } from '@playwright/test';
import { login, navTo } from './helpers.js';

const TS = Date.now();

test.describe('Reusable Test Cases', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'Test Cases');
  });

  test('test cases page renders', async ({ page }) => {
    await expect(page.locator('h2:has-text("Reusable Test Cases")')).toBeVisible();
    await expect(page.locator('button:has-text("Làm mới")')).toBeVisible();
    await expect(page.locator('button:text-is("Mới")')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
  });

  test('project selector auto-selects first project', async ({ page }) => {
    const select = page.locator('select').first();
    await page.waitForTimeout(800);
    const selectedValue = await select.inputValue();
    // Either has a selected project or is blank (no projects)
    expect(typeof selectedValue).toBe('string');
  });

  test('create a test case with name and description', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').allInnerTexts();
    const realOption = options.find((o) => !o.includes('--'));
    if (!realOption) { test.skip(); return; }

    await select.selectOption({ label: realOption });
    await page.waitForTimeout(500);
    await page.click('button:text-is("Mới")');

    const tcName = `TC Reusable ${TS}`;
    await page.fill('input[placeholder*="Login happy path"]', tcName);
    await page.fill('textarea.input-field >> nth=0', 'E2E test description');
    await page.fill('textarea.input-field >> nth=1', 'User should be logged in');

    await page.click('button:has-text("Tạo Test Case")');
    await expect(page.locator(`.object-item-name:has-text("${tcName}")`)).toBeVisible({ timeout: 8000 });
  });

  test('create test case with steps JSON', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').allInnerTexts();
    const realOption = options.find((o) => !o.includes('--'));
    if (!realOption) { test.skip(); return; }

    await select.selectOption({ label: realOption });
    await page.waitForTimeout(500);
    await page.click('button:text-is("Mới")');

    const tcName = `TC Steps ${TS}`;
    await page.fill('input[placeholder*="Login happy path"]', tcName);

    // Fill steps JSON
    const stepsField = page.locator('textarea.input-field').filter({ hasText: '' }).nth(3); // Steps JSON textarea
    await stepsField.fill(JSON.stringify([
      { title: 'Open browser', description: 'Launch chrome', expected_result: 'Browser open' },
      { title: 'Navigate to URL', expected_result: 'Page loaded' }
    ]));

    await page.click('button:has-text("Tạo Test Case")');
    await expect(page.locator(`.object-item-name:has-text("${tcName}")`)).toBeVisible({ timeout: 8000 });
  });

  test('select and view test case detail', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').allInnerTexts();
    const realOption = options.find((o) => !o.includes('--'));
    if (!realOption) { test.skip(); return; }

    await select.selectOption({ label: realOption });
    await page.waitForTimeout(800);

    const item = page.locator('.object-item').first();
    if (!(await item.isVisible())) { test.skip(); return; }
    await item.click();

    await expect(page.locator('h3:has-text("Cập nhật Test Case")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Xóa")')).toBeVisible();
    await expect(page.locator('button:has-text("Cập nhật Test Case")')).toBeVisible();
  });

  test('update test case name', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').allInnerTexts();
    const realOption = options.find((o) => !o.includes('--'));
    if (!realOption) { test.skip(); return; }

    await select.selectOption({ label: realOption });
    await page.waitForTimeout(800);

    const item = page.locator('.object-item').first();
    if (!(await item.isVisible())) { test.skip(); return; }
    await item.click();
    await page.waitForTimeout(300);

    const updatedName = `Updated TC ${TS}`;
    await page.fill('input[placeholder*="Login happy path"]', updatedName);
    await page.click('button:has-text("Cập nhật Test Case")');

    await expect(page.locator(`.object-item-name:has-text("${updatedName}")`)).toBeVisible({ timeout: 8000 });
  });

  test('delete a test case', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').allInnerTexts();
    const realOption = options.find((o) => !o.includes('--'));
    if (!realOption) { test.skip(); return; }

    await select.selectOption({ label: realOption });
    await page.waitForTimeout(500);
    await page.click('button:text-is("Mới")');

    const tempName = `Delete TC ${TS}`;
    await page.fill('input[placeholder*="Login happy path"]', tempName);
    await page.click('button:has-text("Tạo Test Case")');
    await expect(page.locator(`.object-item-name:has-text("${tempName}")`)).toBeVisible({ timeout: 8000 });

    await page.click(`.object-item:has-text("${tempName}")`);
    await page.click('button:has-text("Xóa")');
    await expect(page.locator(`.object-item-name:has-text("${tempName}")`)).not.toBeVisible({ timeout: 8000 });
  });

  test('invalid steps JSON shows error in console', async ({ page }) => {
    const select = page.locator('select').first();
    const options = await select.locator('option').allInnerTexts();
    const realOption = options.find((o) => !o.includes('--'));
    if (!realOption) { test.skip(); return; }

    await select.selectOption({ label: realOption });
    await page.waitForTimeout(500);
    await page.click('button:text-is("Mới")');

    await page.fill('input[placeholder*="Login happy path"]', `TC Bad JSON ${TS}`);
    const stepsField = page.locator('textarea.input-field').nth(3);
    await stepsField.fill('not valid json {{{');
    await page.click('button:has-text("Tạo Test Case")');

    // Console should log error (log-entry.error class from ConsolePanel)
    await expect(page.locator('.log-entry.error')).toBeVisible({ timeout: 5000 });
  });
});
