'use strict';

/**
 * mochaFileWriter.service.js
 *
 * Replaces katalonFileWriter.service.js.
 * Writes Playwright + Mocha + Chai test files to disk with the same public API
 * so all callers (aiAgent.controller, etc.) work without logic changes.
 *
 * File layout inside a project:
 *   tests/cases/<sanitizedName>.spec.js   — individual test case
 *   tests/suites/<sanitizedName>.spec.js  — suite that require()s test cases
 *
 * Object Repository .rs files are replaced by a plain JSON locators file
 * (kept as best-effort, not required for execution).
 */

const fs   = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeFilename(name) {
  return (String(name || ''))
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/'/g, '_')
    .trim() || 'Unnamed';
}

function escapeJs(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/`/g, '\\`');
}

// ── Spec file builders ────────────────────────────────────────────────────────

/**
 * Detect if the provided script is already a complete spec file (has describe/it)
 * or just the inner test body that needs wrapping.
 */
function isCompleteSpec(script) {
  const s = String(script || '').trim();
  return s.startsWith('const ') || s.startsWith('require(') ||
         s.startsWith('import ') || s.startsWith("'use strict'") ||
         /^describe\s*\(/.test(s);
}

/**
 * Wrap a describe block (or raw test body) with Playwright boilerplate.
 */
function wrapWithBoilerplate(tcName, describeBody) {
  return `'use strict';
const { chromium, firefox } = require('playwright');
const chai = require('chai');
const expect = chai.expect;
const path = require('path');
const fs = require('fs');

describe('${escapeJs(tcName)}', () => {
  let browser;
  let page;
  const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots');

  before(async () => {
    const browserType = process.env.TEST_BROWSER || 'chromium';
    const headless = process.env.TEST_HEADLESS !== 'false';
    browser = await require('playwright')[browserType].launch({ headless });
    page = await browser.newPage();
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  });

  after(async () => {
    if (browser) await browser.close();
  });

${describeBody.split('\n').map((l) => '  ' + l).join('\n')}
});
`;
}

/**
 * Build the spec file content for a test case.
 * - If script looks like a complete file → use as-is.
 * - If script contains it() blocks → wrap with browser boilerplate.
 * - If script is empty or just comments → generate a skeleton.
 */
function buildTestCaseSpec(tcName, { description = '', url = '', script = '' } = {}) {
  const s = String(script || '').trim();

  if (s && isCompleteSpec(s)) {
    return s; // already a full spec file
  }

  if (s && (s.includes('it(') || s.includes("it('"))) {
    // Inner test body — wrap with browser setup boilerplate
    return wrapWithBoilerplate(tcName, s);
  }

  // Default skeleton
  const navLine = url
    ? `await page.goto('${escapeJs(url)}');`
    : `// await page.goto('https://example.com');`;

  const descLine = description ? `  // ${escapeJs(description)}` : '';

  const testBody = [
    `  it('${escapeJs(tcName)}', async () => {`,
    `    ${navLine}`,
    descLine,
    ``,
    `    // TODO: Implement test steps`,
    `    // Example:`,
    `    // await page.fill('#username', 'user@example.com');`,
    `    // await page.click('#submit');`,
    `    // expect(page.url()).to.include('/dashboard');`,
    ``,
    `    expect(true).to.equal(true);`,
    `  });`,
  ].filter((l) => l !== undefined).join('\n');

  return wrapWithBoilerplate(tcName, testBody);
}

/**
 * Build a suite spec file that imports all linked test case specs.
 */
function buildSuiteSpec(suiteName, { description = '', testCases = [] } = {}) {
  const safeDesc = description ? `// ${escapeJs(description)}\n` : '';
  const requires = testCases
    .map(({ name }) => {
      const safe = sanitizeFilename(name);
      return `require('../cases/${safe}.spec.js');`;
    })
    .join('\n');

  return `'use strict';
// Suite: ${escapeJs(suiteName)}
${safeDesc}
${requires || '// No test cases linked yet.'}
`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Write a Playwright/Mocha test case spec to disk.
 * Creates: <projectPath>/tests/cases/<safeName>.spec.js
 *
 * @returns {{ specFilePath, diskError }}
 */
function writeTestCaseFile(projectPath, tcName, opts = {}) {
  try {
    if (!projectPath || !tcName) {
      return { specFilePath: null, tcFilePath: null, scriptPath: null,
               diskError: 'Missing projectPath or test case name' };
    }

    const safeName   = sanitizeFilename(tcName);
    const casesDir   = path.join(projectPath, 'tests', 'cases');
    const specPath   = path.join(casesDir, `${safeName}.spec.js`);

    fs.mkdirSync(casesDir, { recursive: true });
    fs.writeFileSync(specPath, buildTestCaseSpec(tcName, opts), 'utf8');

    return {
      specFilePath: specPath,
      tcFilePath:   specPath, // alias for backward compat
      scriptPath:   specPath,
      diskError:    null,
    };
  } catch (err) {
    return { specFilePath: null, tcFilePath: null, scriptPath: null, diskError: err.message };
  }
}

/**
 * Write (or overwrite) a suite spec file to disk.
 * Creates: <projectPath>/tests/suites/<safeName>.spec.js
 *
 * @returns {{ tsFilePath, diskError }}
 */
function writeTestSuiteFile(projectPath, suiteName, opts = {}) {
  try {
    if (!projectPath || !suiteName) {
      return { tsFilePath: null, diskError: 'Missing projectPath or suite name' };
    }

    const safeName  = sanitizeFilename(suiteName);
    const suitesDir = path.join(projectPath, 'tests', 'suites');
    const specPath  = path.join(suitesDir, `${safeName}.spec.js`);

    fs.mkdirSync(suitesDir, { recursive: true });
    fs.writeFileSync(specPath, buildSuiteSpec(suiteName, opts), 'utf8');

    return { tsFilePath: specPath, diskError: null };
  } catch (err) {
    return { tsFilePath: null, diskError: err.message };
  }
}

/**
 * Write a locators JSON file (replaces Katalon Object Repository .rs files).
 * Creates: <projectPath>/tests/locators/<objectPath>.json
 *
 * @returns {{ rsFilePath, diskError }}
 */
function writeObjectRepositoryFile(projectPath, objectPath, opts = {}) {
  try {
    if (!projectPath || !objectPath) {
      return { rsFilePath: null, diskError: 'Missing projectPath or objectPath' };
    }

    const parts = String(objectPath).replace(/\\/g, '/').split('/').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return { rsFilePath: null, diskError: 'Invalid objectPath' };

    const objectName  = parts[parts.length - 1];
    const folderParts = parts.slice(0, -1);
    const dir         = path.join(projectPath, 'tests', 'locators', ...folderParts);
    const filePath    = path.join(dir, `${objectName}.json`);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({
      name:           objectName,
      selectorMethod: opts.selectorMethod || 'XPATH',
      selectorValue:  opts.selectorValue  || '',
      description:    opts.description    || '',
    }, null, 2), 'utf8');

    return { rsFilePath: filePath, diskError: null };
  } catch (err) {
    return { rsFilePath: null, diskError: err.message };
  }
}

/**
 * Delete a test case spec from disk (best-effort).
 */
function deleteTestCaseFile(projectPath, tcName) {
  try {
    if (!projectPath || !tcName) return;
    const p = path.join(projectPath, 'tests', 'cases', `${sanitizeFilename(tcName)}.spec.js`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch { /* non-fatal */ }
}

/**
 * Delete a suite spec from disk (best-effort).
 */
function deleteTestSuiteFile(projectPath, suiteName) {
  try {
    if (!projectPath || !suiteName) return;
    const p = path.join(projectPath, 'tests', 'suites', `${sanitizeFilename(suiteName)}.spec.js`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch { /* non-fatal */ }
}

/**
 * Delete an object repository / locator file from disk (best-effort).
 */
function deleteObjectRepositoryFile(projectPath, objectPath) {
  try {
    if (!projectPath || !objectPath) return;
    const parts = String(objectPath).replace(/\\/g, '/').split('/').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const p = path.join(projectPath, 'tests', 'locators', ...parts.slice(0, -1), `${parts[parts.length - 1]}.json`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch { /* non-fatal */ }
}

module.exports = {
  writeTestCaseFile,
  writeTestSuiteFile,
  writeObjectRepositoryFile,
  deleteTestCaseFile,
  deleteTestSuiteFile,
  deleteObjectRepositoryFile,
};
