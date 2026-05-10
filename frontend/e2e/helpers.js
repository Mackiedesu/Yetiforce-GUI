export const CREDS = { username: 'admin', password: 'admin123' };

/** Log in via the login page and wait for the main app shell. */
export async function login(page) {
  await page.goto('/');
  await page.fill('#username', CREDS.username);
  await page.fill('#password', CREDS.password);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.nav-rail', { timeout: 10000 });
}

/** Click a nav-rail button by its visible text. */
export async function navTo(page, text) {
  await page.click(`.nav-rail-item:has-text("${text}")`);
  await page.waitForTimeout(300);
}

/** Clear localStorage so next test starts without a session. */
export async function clearSession(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}
