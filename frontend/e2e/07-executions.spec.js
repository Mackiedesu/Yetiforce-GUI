import { test, expect } from '@playwright/test';
import { login, navTo } from './helpers.js';

test.describe('Executions / Reports', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'Run Engine');
  });

  test('executions tab renders', async ({ page }) => {
    // Sidebar title with "Executions" text should be visible
    await expect(
      page.locator('.kat-exec-sidebar-title')
    ).toBeVisible({ timeout: 5000 });
    // Console panel still visible at bottom
    await expect(page.locator('.console')).toBeVisible();
  });

  test('shows empty or historical reports', async ({ page }) => {
    await page.waitForTimeout(1000);
    // Either a list of past runs or empty state
    const bodyVisible = await page.locator('.editor-content').isVisible();
    expect(bodyVisible).toBeTruthy();
  });
});
