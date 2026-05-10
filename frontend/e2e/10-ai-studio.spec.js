import { test, expect } from '@playwright/test';
import { login, navTo } from './helpers.js';

test.describe('AI Studio (Feature 7)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'AI Studio');
  });

  test('AI Studio nav item navigates to studio view', async ({ page }) => {
    await expect(page.locator('.studio-layout')).toBeVisible({ timeout: 8000 });
  });

  test('AI Studio has input panel and result panel', async ({ page }) => {
    await expect(page.locator('.studio-input-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.studio-result-panel')).toBeVisible({ timeout: 5000 });
  });

  test('studio header shows AI Agent Studio title', async ({ page }) => {
    await expect(page.locator('.studio-header-title')).toContainText('AI Agent Studio', { timeout: 5000 });
  });

  test('studio header shows subtitle', async ({ page }) => {
    await expect(page.locator('.studio-header-sub')).toBeVisible({ timeout: 5000 });
  });

  test('project selector is visible', async ({ page }) => {
    await expect(page.locator('.studio-input-panel select.input-field')).toBeVisible({ timeout: 5000 });
  });

  test('textarea accepts feature description input', async ({ page }) => {
    const textarea = page.locator('.studio-textarea');
    await textarea.fill('Login feature with username and password');
    await expect(textarea).toHaveValue('Login feature with username and password');
  });

  test('character count updates as user types', async ({ page }) => {
    const textarea = page.locator('.studio-textarea');
    await textarea.fill('Hello');
    await expect(page.locator('.studio-char-count')).toContainText('5 ký tự');
  });

  test('example prompt buttons are shown', async ({ page }) => {
    const examples = page.locator('.studio-example-btn');
    const count = await examples.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('example button populates textarea', async ({ page }) => {
    const example = page.locator('.studio-example-btn').first();
    await example.click();
    const value = await page.locator('.studio-textarea').inputValue();
    expect(value.length).toBeGreaterThan(10);
  });

  test('generate button is disabled when textarea is empty', async ({ page }) => {
    await page.locator('.studio-textarea').fill('');
    await expect(page.locator('.studio-generate-btn')).toBeDisabled();
  });

  test('generate button is enabled after typing', async ({ page }) => {
    await page.locator('.studio-textarea').fill('some feature description');
    await expect(page.locator('.studio-generate-btn')).toBeEnabled();
  });

  test('empty state is shown before any generation', async ({ page }) => {
    await expect(page.locator('.studio-empty-state')).toBeVisible({ timeout: 5000 });
  });

  test('Ctrl+Enter shortcut hint is visible', async ({ page }) => {
    await expect(page.locator('.studio-hint')).toContainText('Ctrl+Enter');
  });

  test('nav rail shows AI Studio as active', async ({ page }) => {
    await expect(page.locator('.nav-rail-item:has-text("AI Studio")')).toHaveClass(/active/);
  });
});
