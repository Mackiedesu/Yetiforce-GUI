import { test, expect } from '@playwright/test';
import { login, navTo } from './helpers.js';

test.describe('Website Scanner (Feature 8)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'Scanner');
  });

  test('scanner nav item navigates to scanner view', async ({ page }) => {
    await expect(page.locator('.scanner-root')).toBeVisible({ timeout: 8000 });
  });

  test('scanner header shows title and feature badge', async ({ page }) => {
    await expect(page.locator('.scanner-header-title')).toContainText('Website Scanner');
    await expect(page.locator('.scanner-feature-badge')).toContainText('Feature 8');
  });

  test('scanner header shows description text', async ({ page }) => {
    await expect(page.locator('.scanner-header-desc')).toBeVisible({ timeout: 5000 });
  });

  test('URL input bar is present', async ({ page }) => {
    await expect(page.locator('.scanner-url-bar')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.scanner-url-input')).toBeVisible({ timeout: 5000 });
  });

  test('URL input accepts text', async ({ page }) => {
    const input = page.locator('.scanner-url-input');
    await input.fill('https://example.com');
    await expect(input).toHaveValue('https://example.com');
  });

  test('scan button is present', async ({ page }) => {
    await expect(page.locator('.scanner-scan-btn')).toBeVisible({ timeout: 5000 });
  });

  test('scan button is disabled when URL is empty', async ({ page }) => {
    await page.locator('.scanner-url-input').fill('');
    await expect(page.locator('.scanner-scan-btn')).toBeDisabled();
  });

  test('scan button is enabled when URL is entered', async ({ page }) => {
    await page.locator('.scanner-url-input').fill('https://example.com');
    await expect(page.locator('.scanner-scan-btn')).toBeEnabled();
  });

  test('empty state is shown initially', async ({ page }) => {
    await expect(page.locator('.scanner-empty-state')).toBeVisible({ timeout: 5000 });
  });

  test('scanner nav rail item is active when on scanner page', async ({ page }) => {
    await expect(page.locator('.nav-rail-item:has-text("Scanner")')).toHaveClass(/active/);
  });

  test('pressing Enter in URL input triggers scan attempt', async ({ page }) => {
    await page.locator('.scanner-url-input').fill('https://example.com');
    await page.keyboard.press('Enter');
    // Loading state or error should appear (no actual scan in unit test)
    await page.waitForTimeout(500);
    // Either loading spinner or error (connection refused in test env is fine)
    const hasLoading = await page.locator('.scanner-loading-state').isVisible();
    const hasError = await page.locator('.scanner-error').isVisible();
    expect(hasLoading || hasError).toBeTruthy();
  });
});
