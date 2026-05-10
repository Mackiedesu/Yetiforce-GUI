import { test, expect } from '@playwright/test';
import { login, navTo } from './helpers.js';

test.describe('Dashboard (Feature 6)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'Dashboard');
  });

  test('dashboard nav item shows dashboard view', async ({ page }) => {
    await expect(page.locator('.dash-root')).toBeVisible({ timeout: 8000 });
  });

  test('dashboard shows stat cards', async ({ page }) => {
    await expect(page.locator('.dash-stat-card').first()).toBeVisible({ timeout: 8000 });
    const count = await page.locator('.dash-stat-card').count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('dashboard shows header with runs badge', async ({ page }) => {
    await expect(page.locator('.dash-header')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.dash-total-badge').first()).toBeVisible();
  });

  test('dashboard shows execution history table', async ({ page }) => {
    await expect(page.locator('.dash-table-wrap')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.dash-table')).toBeVisible();
  });

  test('dashboard table has required column headers', async ({ page }) => {
    // Wait for table to be visible and check individual header cells
    await expect(page.locator('.dash-table')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.dash-table th:has-text("Project")')).toBeVisible();
    await expect(page.locator('.dash-table th:has-text("Browser")')).toBeVisible();
    await expect(page.locator('.dash-table th:has-text("Status")')).toBeVisible();
  });

  test('dashboard filter controls are visible', async ({ page }) => {
    await expect(page.locator('.dash-table-controls')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.dash-filter-select')).toBeVisible();
  });

  test('dashboard table section title is visible', async ({ page }) => {
    await expect(page.locator('.dash-table-title')).toContainText('Execution History', { timeout: 8000 });
  });

  test('status filter select has options', async ({ page }) => {
    const opts = await page.locator('.dash-filter-select option').allInnerTexts();
    expect(opts.length).toBeGreaterThanOrEqual(2);
    expect(opts[0]).toContain('All');
  });

  test('dashboard nav rail item is active', async ({ page }) => {
    await expect(page.locator('.nav-rail-item:has-text("Dashboard")')).toHaveClass(/active/);
  });

  test('refresh button is present in header', async ({ page }) => {
    await expect(page.locator('.dash-header .toolbar-btn')).toBeVisible({ timeout: 5000 });
  });
});
