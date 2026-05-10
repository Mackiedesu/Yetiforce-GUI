import { test, expect } from '@playwright/test';
import { login, clearSession } from './helpers.js';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await clearSession(page);
  });

  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.login-page')).toBeVisible();
    await expect(page.locator('.login-brand')).toContainText('YetiForce GUI');
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('.login-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.login-error')).toContainText('Invalid');
    // Still on login page
    await expect(page.locator('.login-page')).toBeVisible();
  });

  test('shows error for empty username', async ({ page }) => {
    await page.goto('/');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    // HTML5 required validation prevents submit — login page still visible
    await expect(page.locator('.login-page')).toBeVisible();
  });

  test('logs in successfully with valid credentials', async ({ page }) => {
    await login(page);
    // Main app shell is visible
    await expect(page.locator('.nav-rail')).toBeVisible();
    await expect(page.locator('.app-header')).toBeVisible();
    // Login page is gone
    await expect(page.locator('.login-page')).not.toBeVisible();
  });

  test('shows username in header toolbar after login', async ({ page }) => {
    await login(page);
    await expect(page.locator('.toolbar-user')).toContainText('admin');
  });

  test('logout returns to login page', async ({ page }) => {
    await login(page);
    await page.click('.toolbar-btn-logout');
    await expect(page.locator('.login-page')).toBeVisible({ timeout: 5000 });
    // Main app is gone
    await expect(page.locator('.nav-rail')).not.toBeVisible();
  });

  test('session persists on page reload', async ({ page }) => {
    await login(page);
    await page.reload();
    // Still logged in — main app visible
    await expect(page.locator('.nav-rail')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.login-page')).not.toBeVisible();
  });
});
