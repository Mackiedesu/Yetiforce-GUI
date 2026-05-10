import { test, expect } from '@playwright/test';
import { login, navTo } from './helpers.js';

test.describe('AI Generator', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'AI Generator');
  });

  test('AI generator tab renders both panels', async ({ page }) => {
    await expect(page.locator('.ai-gen-layout')).toBeVisible();
    await expect(page.locator('.ai-gen-input-panel')).toBeVisible();
    await expect(page.locator('.ai-gen-output-panel')).toBeVisible();
  });

  test('shows title and subtitle', async ({ page }) => {
    await expect(page.locator('.ai-gen-title')).toContainText('AI Test Generator');
    await expect(page.locator('.ai-gen-subtitle')).toBeVisible();
  });

  test('textarea accepts input', async ({ page }) => {
    const textarea = page.locator('.ai-gen-textarea');
    await textarea.fill('Test login with valid credentials');
    await expect(textarea).toHaveValue('Test login with valid credentials');
  });

  test('character count updates as user types', async ({ page }) => {
    const textarea = page.locator('.ai-gen-textarea');
    const charCount = page.locator('.ai-gen-char-count');
    await textarea.fill('Hello world');
    await expect(charCount).toContainText('11 ký tự');
  });

  test('generate button is disabled when textarea is empty', async ({ page }) => {
    const btn = page.locator('#ai-gen-generate-btn');
    await expect(btn).toBeDisabled();
  });

  test('generate button is enabled after typing', async ({ page }) => {
    await page.locator('.ai-gen-textarea').fill('Test something');
    await expect(page.locator('#ai-gen-generate-btn')).toBeEnabled();
  });

  test('example buttons populate textarea', async ({ page }) => {
    const exampleBtn = page.locator('.ai-gen-example-item').first();
    await exampleBtn.click();
    const textarea = page.locator('.ai-gen-textarea');
    const value = await textarea.inputValue();
    expect(value.length).toBeGreaterThan(10);
  });

  test('output tabs are rendered', async ({ page }) => {
    await expect(page.locator('#ai-gen-tab-steps')).toContainText('Test Steps');
    await expect(page.locator('#ai-gen-tab-results')).toContainText('Expected Results');
    await expect(page.locator('#ai-gen-tab-data')).toContainText('Test Data');
    await expect(page.locator('#ai-gen-tab-script')).toContainText('Katalon Script');
  });

  test('output tabs are clickable', async ({ page }) => {
    await page.click('#ai-gen-tab-results');
    await expect(page.locator('#ai-gen-tab-results')).toHaveClass(/active/);
    await page.click('#ai-gen-tab-data');
    await expect(page.locator('#ai-gen-tab-data')).toHaveClass(/active/);
    await page.click('#ai-gen-tab-script');
    await expect(page.locator('#ai-gen-tab-script')).toHaveClass(/active/);
  });

  test('empty state shows when no result yet', async ({ page }) => {
    await expect(page.locator('.ai-gen-empty')).toBeVisible();
    await expect(page.locator('.ai-gen-empty h3')).toContainText('Chưa có kết quả');
  });

  test('Ctrl+Enter hint is visible', async ({ page }) => {
    await expect(page.locator('.ai-gen-hint')).toContainText('Ctrl+Enter');
  });
});
