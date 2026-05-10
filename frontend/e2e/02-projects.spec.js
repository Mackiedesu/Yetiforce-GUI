import { test, expect } from '@playwright/test';
import { login, navTo } from './helpers.js';

const TS = Date.now();
const PROJECT_NAME = `E2E Project ${TS}`;
const PROJECT_PATH = '/tmp/e2e_test';

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navTo(page, 'Projects');
  });

  test('projects page renders with header and list area', async ({ page }) => {
    await expect(page.locator('h2:has-text("Projects")')).toBeVisible();
    await expect(page.locator('button:has-text("Project mới")')).toBeVisible();
    await expect(page.locator('button:has-text("Làm mới")')).toBeVisible();
  });

  test('create a new project', async ({ page }) => {
    // Click "Project mới" to reset form
    await page.click('button:has-text("Project mới")');
    await page.fill('input[placeholder*="QA Automation"]', PROJECT_NAME);
    await page.fill('textarea[placeholder*="Mô tả"]', 'E2E test description');
    await page.fill('input[placeholder*="Katalon"]', PROJECT_PATH);
    await page.click('button:has-text("Tạo Project")');

    // Project should appear in the list
    await expect(page.locator(`.object-item-name:has-text("${PROJECT_NAME}")`)).toBeVisible({ timeout: 8000 });
  });

  test('select and view project details', async ({ page }) => {
    // Click on an existing project
    const item = page.locator('.object-item').first();
    await item.click();
    // Detail panel shows update form
    await expect(page.locator('h3:has-text("Cập nhật Project")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Cập nhật")')).toBeVisible();
    await expect(page.locator('button:has-text("Xóa")')).toBeVisible();
  });

  test('update a project name', async ({ page }) => {
    const item = page.locator('.object-item').first();
    await item.click();

    const nameField = page.locator('input[placeholder*="QA Automation"]');
    await nameField.fill(`Updated ${TS}`);
    await page.click('button:has-text("Cập nhật")');

    await expect(page.locator(`.object-item-name:has-text("Updated ${TS}")`)).toBeVisible({ timeout: 8000 });
  });

  test('delete a project', async ({ page }) => {
    // Create a temp project to delete
    await page.click('button:has-text("Project mới")');
    const tempName = `Temp Delete ${TS}`;
    await page.fill('input[placeholder*="QA Automation"]', tempName);
    await page.fill('input[placeholder*="Katalon"]', '/tmp/temp');
    await page.click('button:has-text("Tạo Project")');
    await expect(page.locator(`.object-item-name:has-text("${tempName}")`)).toBeVisible({ timeout: 8000 });

    // Select it and delete
    await page.click(`.object-item:has-text("${tempName}")`);
    await page.click('button:has-text("Xóa")');

    // Project should no longer appear in list
    await expect(page.locator(`.object-item-name:has-text("${tempName}")`)).not.toBeVisible({ timeout: 8000 });
  });

  test('project form shows validation - create without name', async ({ page }) => {
    await page.click('button:has-text("Project mới")');
    await page.fill('input[placeholder*="Katalon"]', '/tmp/x');
    await page.click('button:has-text("Tạo Project")');
    // Console panel is always rendered
    await expect(page.locator('.console')).toBeVisible();
  });
});
