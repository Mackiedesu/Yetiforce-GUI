/**
 * Yetiforce-GUI — Automated Screenshot Capture
 *
 * Usage:
 *   node scripts/capture-screenshots.js
 *   (or)  npm run screenshots
 *
 * Prerequisites:
 *   1. Backend running on http://localhost:5000
 *   2. Frontend running on http://localhost:5173 (npm run dev)
 *   3. PostgreSQL running and migrated
 *   4. npx playwright install chromium  (first time only)
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:5000';
const USERNAME = 'admin';
const PASSWORD = 'admin123';
const VIEWPORT = { width: 1440, height: 900 };
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/screenshots');
const WAIT_AFTER_NAV = 1200; // ms to let React re-render settle

// ── Utility helpers ───────────────────────────────────────────────────────────

function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function pause(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function shot(page, subdir, name) {
  const dir = path.join(SCREENSHOT_DIR, subdir);
  ensure(dir);
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✔ ${subdir}/${name}.png`);
  return file;
}

// ── Seed helpers (call backend REST API directly) ─────────────────────────────

let authToken = null;
let seededProjectId = null;
let seededSuiteId = null;

async function apiLogin() {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/auth/login`, { username: USERNAME, password: PASSWORD });
    authToken = res.data.token;
    console.log('  API login OK');
  } catch (err) {
    console.warn('  API login failed — backend may not be running:', err.message);
  }
}

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function seedProject() {
  if (!authToken) return null;
  try {
    // Try to reuse an existing project named "Demo QA Project"
    const listRes = await axios.get(`${BACKEND_URL}/api/projects`, { headers: authHeaders() });
    const existing = (listRes.data.projects || []).find((p) => p.name === 'Demo QA Project');
    if (existing) {
      seededProjectId = existing.id;
      console.log(`  Reusing project id=${seededProjectId}`);
      return seededProjectId;
    }
    // Create via import — use the project's own backend folder as a real existing path
    const res = await axios.post(`${BACKEND_URL}/api/projects/import`, {
      name: 'Demo QA Project',
      description: 'Sample project for documentation screenshots',
      katalon_project_path: 'G:\QA-Studio-for-Yetiforce-UI-Testing',
    }, { headers: authHeaders() });
    seededProjectId = res.data.project.id;
    console.log(`  Created project id=${seededProjectId}`);
    return seededProjectId;
  } catch (err) {
    console.warn('  Seed project failed:', err.response?.data?.error || err.message);
    return null;
  }
}

async function seedSuite(projectId) {
  if (!authToken || !projectId) return null;
  try {
    const listRes = await axios.get(`${BACKEND_URL}/api/projects/${projectId}/suites`, { headers: authHeaders() });
    const existing = (listRes.data.suites || []).find((s) => s.name === 'Smoke Test Suite');
    if (existing) {
      seededSuiteId = existing.id;
      console.log(`  Reusing suite id=${seededSuiteId}`);
      return seededSuiteId;
    }
    const res = await axios.post(`${BACKEND_URL}/api/projects/${projectId}/suites`, {
      name: 'Smoke Test Suite',
      description: 'Automated smoke tests for core flows',
    }, { headers: authHeaders() });
    seededSuiteId = res.data.suite.id;
    console.log(`  Created suite id=${seededSuiteId}`);
    return seededSuiteId;
  } catch (err) {
    console.warn('  Seed suite failed:', err.response?.data?.error || err.message);
    return null;
  }
}

async function seedTestCases(projectId, suiteId) {
  if (!authToken || !projectId) return;
  const cases = [
    {
      name: 'TC-001: Login with valid credentials',
      description: 'Verify that a registered user can log in successfully with correct username and password.',
      expected_result: 'User is redirected to the dashboard and sees their profile.',
      url: 'https://yetiforce.example.com/login',
      steps: [
        { title: 'Open login page', description: 'Navigate to /login URL', expected_result: 'Login form is visible' },
        { title: 'Enter credentials', description: 'Fill username and password fields', expected_result: 'Fields are populated' },
        { title: 'Submit form', description: 'Click Sign In button', expected_result: 'User is authenticated and redirected' },
      ],
      data_sets: [
        { username: 'admin@example.com', password: 'Admin123!', description: 'Valid admin login' },
      ],
    },
    {
      name: 'TC-002: Login with invalid password',
      description: 'Verify that login fails when an incorrect password is provided.',
      expected_result: 'Error message is displayed and user stays on login page.',
      url: 'https://yetiforce.example.com/login',
      steps: [
        { title: 'Open login page', description: 'Navigate to /login URL', expected_result: 'Login form is visible' },
        { title: 'Enter wrong password', description: 'Fill valid username, invalid password', expected_result: 'Fields populated' },
        { title: 'Submit form', description: 'Click Sign In button', expected_result: 'Error banner appears' },
      ],
      data_sets: [
        { username: 'admin@example.com', password: 'wrongpass', description: 'Invalid password' },
      ],
    },
    {
      name: 'TC-003: Create new CRM contact',
      description: 'Verify that a user can create a new contact record in the CRM module.',
      expected_result: 'Contact is saved and appears in the contact list.',
      url: 'https://yetiforce.example.com/crm/contacts',
      steps: [
        { title: 'Navigate to Contacts', description: 'Click CRM → Contacts in navigation', expected_result: 'Contact list is displayed' },
        { title: 'Click Create', description: 'Press the "+ New Contact" button', expected_result: 'Creation form opens' },
        { title: 'Fill contact details', description: 'Enter first name, last name, email, phone', expected_result: 'All fields accepted' },
        { title: 'Save contact', description: 'Click Save button', expected_result: 'Contact record is created' },
      ],
    },
    {
      name: 'TC-004: Search contact by email',
      description: 'Verify that the search feature returns the correct contact when searching by email.',
      expected_result: 'Search results show the matching contact.',
      url: 'https://yetiforce.example.com/crm/contacts',
      steps: [
        { title: 'Open Contacts page', description: 'Navigate to CRM → Contacts', expected_result: 'Contact list loads' },
        { title: 'Enter email in search', description: 'Type email address in the search bar', expected_result: 'List filters as user types' },
        { title: 'Verify result', description: 'Check that matching contact appears', expected_result: 'Correct contact is shown' },
      ],
    },
  ];

  for (const tc of cases) {
    try {
      const listRes = await axios.get(`${BACKEND_URL}/api/projects/${projectId}/test-cases`, { headers: authHeaders() });
      if ((listRes.data.test_cases || []).some((t) => t.name === tc.name)) {
        console.log(`  Test case already exists: ${tc.name}`);
        continue;
      }
      const res = await axios.post(`${BACKEND_URL}/api/projects/${projectId}/test-cases`, {
        name: tc.name,
        description: tc.description,
        expected_result: tc.expected_result,
        url: tc.url,
        steps: tc.steps || [],
        data_sets: tc.data_sets || [],
        script: '',
      }, { headers: authHeaders() });

      const tcId = res.data.test_case.id;
      console.log(`  Created test case: ${tc.name}`);

      // Link to suite if provided
      if (suiteId) {
        await axios.post(
          `${BACKEND_URL}/api/projects/${projectId}/suites/${suiteId}/test-cases`,
          { test_case_id: tcId },
          { headers: authHeaders() }
        ).catch(() => { });
      }
    } catch (err) {
      console.warn(`  Seed TC failed (${tc.name}):`, err.response?.data?.error || err.message);
    }
  }
}

// ── UI navigation helpers ─────────────────────────────────────────────────────

async function doLogin(page) {
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  await pause(800);

  // If already logged in (past login screen), return
  const loginForm = page.locator('.login-form');
  if (!(await loginForm.isVisible().catch(() => false))) {
    console.log('  Already logged in');
    return;
  }

  await page.fill('#username', USERNAME);
  await page.fill('#password', PASSWORD);
  await page.click('.login-btn');
  await page.waitForSelector('.nav-rail', { timeout: 10000 });
  await pause(WAIT_AFTER_NAV);
}

async function clickNav(page, navId) {
  const btn = page.locator(`.nav-rail-item`).filter({ hasText: '' }).nth(
    ['home', 'tests', 'plans', 'studio', 'executions', 'analytics'].indexOf(navId)
  );
  // Use title attribute instead for reliability
  await page.locator(`.nav-rail-item[title*="${navId === 'home' ? 'Projects' : navId === 'tests' ? 'Test Suites' : navId === 'plans' ? 'Test Cases' : navId === 'studio' ? 'AI QA Studio' : navId === 'executions' ? 'Run Engine' : 'Dashboard'}"]`).click();
  await pause(WAIT_AFTER_NAV);
}

// ── Main capture flow ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎬 Yetiforce-GUI Screenshot Capture\n');

  // Seed data via API
  console.log('📦 Seeding demo data via backend API…');
  await apiLogin();
  const projectId = await seedProject();
  const suiteId = await seedSuite(projectId);
  await seedTestCases(projectId, suiteId);

  // Launch browser
  console.log('\n🌐 Launching Chromium…');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1.5,
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  // Silence console noise from the app
  page.on('console', () => { });
  page.on('pageerror', () => { });

  try {
    // ── 1. Login page ─────────────────────────────────────────────────────────
    console.log('\n📸 [auth] Login page');
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await pause(1000);
    // Clear any stored auth so we see the login screen
    await page.evaluate(() => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await pause(1000);
    await shot(page, 'auth', 'login-page');

    // Fill credentials (screenshot with populated form)
    await page.fill('#username', USERNAME);
    await page.fill('#password', PASSWORD);
    await shot(page, 'auth', 'login-credentials-filled');

    // ── 2. Login & reach home ────────────────────────────────────────────────
    console.log('\n📸 [projects] Projects page');
    await page.click('.login-btn');
    await page.waitForSelector('.nav-rail', { timeout: 12000 });
    await pause(WAIT_AFTER_NAV + 500);
    await shot(page, 'projects', 'projects-overview');

    // ── 3. Create project form — "Tạo Project mới" tab ───────────────────────
    console.log('  → Create project form');
    // Already on generate tab by default
    await page.fill('input[placeholder="VD: QA_Automation_Core"]', 'MyNewProject').catch(() => { });
    await pause(400);
    await shot(page, 'projects', 'create-project-form');

    // ── 4. Import project form ───────────────────────────────────────────────
    console.log('  → Import project form');
    await page.locator('.project-mode-tab').filter({ hasText: 'Import Project' }).click().catch(() => { });
    await pause(600);
    await shot(page, 'projects', 'import-project-form');

    // ── 5. Project detail / edit ─────────────────────────────────────────────
    if (seededProjectId) {
      console.log('  → Project detail (edit mode)');
      // Click the first project in the list
      await page.locator('.object-item').first().click().catch(() => { });
      await pause(WAIT_AFTER_NAV);
      await shot(page, 'projects', 'project-detail-edit');
    }

    // ── 6. Test Suites page ──────────────────────────────────────────────────
    console.log('\n📸 [test-suites] Test Suites page');
    await clickNav(page, 'tests');
    await pause(WAIT_AFTER_NAV);
    await shot(page, 'test-suites', 'test-suites-overview');

    // Click first suite if present
    const suiteItem = page.locator('.object-item').first();
    if (await suiteItem.isVisible().catch(() => false)) {
      await suiteItem.click();
      await pause(WAIT_AFTER_NAV);
      await shot(page, 'test-suites', 'test-suite-detail');
    }

    // Create new suite button
    console.log('  → New suite form');
    await page.locator('button').filter({ hasText: 'Suite mới' }).click().catch(() => { });
    await pause(600);
    await shot(page, 'test-suites', 'create-suite-form');

    // ── 7. Test Cases page ────────────────────────────────────────────────────
    console.log('\n📸 [test-cases] Test Cases page');
    await clickNav(page, 'plans');
    await pause(WAIT_AFTER_NAV);
    await shot(page, 'test-cases', 'test-cases-overview');

    // Select a project in dropdown if available
    try {
      const projectSelect = page.locator('select').first();
      const projectOptions = await projectSelect.locator('option').count();
      if (projectOptions > 1) {
        await projectSelect.selectOption({ index: 1 }, { force: true, timeout: 5000 });
        await pause(WAIT_AFTER_NAV);
        await shot(page, 'test-cases', 'test-cases-project-selected');
      }
    } catch {
      // skip if project select fails
    }

    // Click first test case
    const tcItem = page.locator('.object-item').first();
    if (await tcItem.isVisible().catch(() => false)) {
      await tcItem.click();
      await pause(WAIT_AFTER_NAV);
      await shot(page, 'test-cases', 'test-case-detail');
    }

    // New test case form
    console.log('  → New test case form');
    await page.locator('button').filter({ hasText: 'Mới' }).click().catch(() => { });
    await pause(400);
    await page.fill('input[placeholder="VD: Login happy path"]', 'TC-005: Verify dashboard widgets').catch(() => { });
    await pause(400);
    await shot(page, 'test-cases', 'manual-test-case-form');

    // Suite multi-select dropdown
    console.log('  → Suite link dropdown');
    await page.locator('.suite-ms-trigger').click().catch(() => { });
    await pause(500);
    await shot(page, 'test-cases', 'test-case-suite-link-dropdown');
    await page.locator('.suite-ms-trigger').click().catch(() => { }); // close

    // ── 8. AI QA Studio ──────────────────────────────────────────────────────
    console.log('\n📸 [ai-qa-studio] AI QA Studio');
    await clickNav(page, 'studio');
    await pause(WAIT_AFTER_NAV);
    await shot(page, 'ai-qa-studio', 'ai-studio-overview');

    // URL scanner section
    console.log('  → URL Scanner');
    await page.locator('.studio-url-input, input[placeholder*="https://"]').first().fill('https://example.com').catch(() => { });
    await pause(400);
    await shot(page, 'ai-qa-studio', 'ai-studio-url-scanner');

    // Generator tab / generate test cases
    console.log('  → AI Generate section');
    await shot(page, 'ai-qa-studio', 'ai-generate-test-case');

    // ── 9. Run Engine ─────────────────────────────────────────────────────────
    console.log('\n📸 [run-engine] Run Engine');
    await clickNav(page, 'executions');
    await pause(WAIT_AFTER_NAV);
    await shot(page, 'run-engine', 'run-engine-overview');

    // New execution button
    const newExecBtn = page.locator('button').filter({ hasText: /Tạo Execution|Execution mới/i });
    if (await newExecBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newExecBtn.click();
      await pause(800);
      await shot(page, 'run-engine', 'run-engine-new-execution-form');

      // Try to select a project in the execution form (may be inside a panel, use force)
      try {
        const projSelectExec = page.locator('.kat-form select, .object-detail select').first();
        const execOpts = await projSelectExec.locator('option').count();
        if (execOpts > 1) {
          await projSelectExec.selectOption({ index: 1 }, { force: true, timeout: 5000 });
          await pause(600);
          await shot(page, 'run-engine', 'run-engine-form-project-selected');
        }
      } catch {
        // form select not available, skip
      }
    }

    // Execution list (existing runs)
    console.log('  → Execution list');
    await shot(page, 'run-engine', 'run-engine-execution-list');

    // ── 10. Dashboard (Analytics) ──────────────────────────────────────────────
    console.log('\n📸 [dashboard] Execution Dashboard');
    await clickNav(page, 'analytics');
    await pause(WAIT_AFTER_NAV + 500);
    await shot(page, 'dashboard', 'dashboard-overview');

    // Stats & charts
    console.log('  → Dashboard stats');
    await shot(page, 'dashboard', 'dashboard-execution-stats');

    // ── 11. Execution report / report viewer ───────────────────────────────────
    console.log('\n📸 [reports] Execution Report');
    await clickNav(page, 'executions');
    await pause(WAIT_AFTER_NAV);

    // Click first execution in list if any
    const execItem = page.locator('.kat-run-item, .exec-item, .object-item').first();
    if (await execItem.isVisible().catch(() => false)) {
      await execItem.click();
      await pause(WAIT_AFTER_NAV);
      await shot(page, 'reports', 'execution-report-detail');

      // If there's a report/log section
      const logSection = page.locator('.kat-log-wrap, .console-output, .exec-log').first();
      if (await logSection.isVisible().catch(() => false)) {
        await shot(page, 'reports', 'execution-log-viewer');
      }
    }

    await shot(page, 'execution', 'execution-history-list');

    // ── 12. Full-app overview (nav + content) ─────────────────────────────────
    console.log('\n📸 [dashboard] Full app view');
    await clickNav(page, 'analytics');
    await pause(WAIT_AFTER_NAV);
    await shot(page, 'dashboard', 'full-app-overview');

    // ── 13. Manual vs AI comparison (both views side-by-side) ─────────────────
    console.log('\n📸 [manual-vs-ai] Manual test case view');
    await clickNav(page, 'plans');
    await pause(WAIT_AFTER_NAV);
    await shot(page, 'manual-vs-ai', 'manual-test-case-view');

    console.log('  → AI Studio view');
    await clickNav(page, 'studio');
    await pause(WAIT_AFTER_NAV);
    await shot(page, 'manual-vs-ai', 'ai-generated-test-case-view');

    console.log('\n✅ All screenshots captured!\n');
    console.log(`📁 Saved to: ${SCREENSHOT_DIR}`);

  } catch (err) {
    console.error('\n❌ Screenshot capture error:', err.message);
    // Capture a "last-known-state" screenshot for debugging
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '_error-state.png') }).catch(() => { });
    throw err;
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n📋 Screenshot manifest:');
  const folders = fs.readdirSync(SCREENSHOT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const folder of folders) {
    const dir = path.join(SCREENSHOT_DIR, folder);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));
    if (files.length > 0) {
      console.log(`  ${folder}/`);
      files.forEach((f) => console.log(`    ${f}`));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
