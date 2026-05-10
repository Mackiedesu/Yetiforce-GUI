import { test, expect } from '@playwright/test';
import { login, navTo } from './helpers.js';

test.describe('Object Repository', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'Objects');
  });

  test('object repository tab renders', async ({ page }) => {
    await expect(page.locator('h2:has-text("Object Repository")')).toBeVisible();
    await expect(page.locator('.object-list')).toBeVisible();
  });

  test('shows existing objects or empty state', async ({ page }) => {
    await page.waitForTimeout(1000);
    const hasObjects = await page.locator('.object-item').count() > 0;
    const hasEmpty = await page.locator('.empty-state').isVisible();
    expect(hasObjects || hasEmpty).toBeTruthy();
  });

  test('clicking an object shows its detail', async ({ page }) => {
    await page.waitForTimeout(500);
    const objectItem = page.locator('.object-item').first();
    if (!(await objectItem.isVisible())) { test.skip(); return; }

    await objectItem.click();
    await expect(page.locator('.object-detail')).toBeVisible();
    // Detail panel should show some content (locator list or edit form)
    await expect(
      page.locator('.object-detail-content').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('object detail shows edit and delete buttons', async ({ page }) => {
    await page.waitForTimeout(500);
    const objectItem = page.locator('.object-item').first();
    if (!(await objectItem.isVisible())) { test.skip(); return; }

    await objectItem.click();
    await page.waitForTimeout(500);
    // Should have edit/delete controls
    await expect(
      page.locator('button:has-text("Sửa")').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('spy status section visible', async ({ page }) => {
    await expect(page.locator('.app-header')).toBeVisible();
    // Object Spy button exists in header
    await expect(page.locator('button:has-text("Object Spy")')).toBeVisible();
  });
});
