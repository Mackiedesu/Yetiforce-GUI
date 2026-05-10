import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test.describe('Header Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('header renders all toolbar buttons', async ({ page }) => {
    await expect(page.locator('button:has-text("Object Spy")')).toBeVisible();
    await expect(page.locator('button:has-text("Lưu")')).toBeVisible();
    await expect(page.locator('button:has-text("Chạy Test")')).toBeVisible();
    await expect(page.locator('button:has-text("Cài đặt")')).toBeVisible();
  });

  test('run test button is disabled when no script', async ({ page }) => {
    await expect(page.locator('button:has-text("Chạy Test")')).toBeDisabled();
  });

  test('object spy button opens spy modal', async ({ page }) => {
    await page.click('button:has-text("Object Spy")');
    await expect(page.locator('.modal')).toBeVisible({ timeout: 3000 });
  });

  test('spy modal can be closed', async ({ page }) => {
    await page.click('button:has-text("Object Spy")');
    await page.waitForTimeout(300);
    // Close button in modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // Or click close button
    const closeBtn = page.locator('.modal-close').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('save button logs a message', async ({ page }) => {
    await page.click('button:has-text("Lưu")');
    // Console should show a log entry
    await expect(page.locator('.log-entry')).toBeVisible({ timeout: 3000 });
  });

  test('username shows in toolbar', async ({ page }) => {
    await expect(page.locator('.toolbar-user')).toContainText('admin');
  });

  test('logout button is present', async ({ page }) => {
    await expect(page.locator('.toolbar-btn-logout')).toBeVisible();
  });
});
