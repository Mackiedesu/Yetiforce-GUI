'use strict';

/**
 * pathSanitizer.test.js
 *
 * Unit tests for the pathSanitizer utility.
 *
 * Run with:
 *   node src/utils/pathSanitizer.test.js
 *
 * (No external test framework needed — uses Node's built-in assert module.)
 */

const assert = require('assert');
const { sanitizePath, sanitizeProfile } = require('./pathSanitizer');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`         ${err.message}`);
    failed++;
  }
}

// ── sanitizePath ─────────────────────────────────────────────────────────────

console.log('\n── sanitizePath ─────────────────────────────────────────────────────');

test('plain path without quotes is returned as-is', () => {
  assert.strictEqual(sanitizePath('Test Suites/LoginSuite'), 'Test Suites/LoginSuite');
});

test('double-quoted path has quotes stripped', () => {
  assert.strictEqual(sanitizePath('"Test Suites/LoginSuite"'), 'Test Suites/LoginSuite');
});

test('single-quoted path has quotes stripped', () => {
  assert.strictEqual(sanitizePath("'Test Suites/LoginSuite'"), 'Test Suites/LoginSuite');
});

test('leading and trailing spaces are trimmed', () => {
  assert.strictEqual(sanitizePath('  Test Suites/LoginSuite  '), 'Test Suites/LoginSuite');
});

test('spaces + double quotes are both handled', () => {
  assert.strictEqual(sanitizePath('  "Test Suites/LoginSuite"  '), 'Test Suites/LoginSuite');
});

test('spaces + single quotes are both handled', () => {
  assert.strictEqual(sanitizePath("  'Test Suites/LoginSuite'  "), 'Test Suites/LoginSuite');
});

test('internal double spaces are collapsed', () => {
  assert.strictEqual(sanitizePath('Test  Suites/Login  Suite'), 'Test Suites/Login Suite');
});

test('Windows-style backslash path is preserved', () => {
  assert.strictEqual(
    sanitizePath('C:\\Katalon\\My Project\\Test Suites\\Login'),
    'C:\\Katalon\\My Project\\Test Suites\\Login',
  );
});

test('double-quoted Windows path has quotes stripped', () => {
  assert.strictEqual(
    sanitizePath('"C:\\Katalon\\My Project\\Test Suites\\Login"'),
    'C:\\Katalon\\My Project\\Test Suites\\Login',
  );
});

test('path with no spaces works fine', () => {
  assert.strictEqual(sanitizePath('Test Suites/Regression'), 'Test Suites/Regression');
});

test('empty string throws', () => {
  assert.throws(() => sanitizePath(''), /không được để trống/);
});

test('whitespace-only string throws', () => {
  assert.throws(() => sanitizePath('   '), /không được để trống/);
});

test('empty-quoted string throws', () => {
  assert.throws(() => sanitizePath('""'), /không được để trống/);
});

test('non-string throws', () => {
  assert.throws(() => sanitizePath(null), /phải là chuỗi/);
  assert.throws(() => sanitizePath(123),  /phải là chuỗi/);
  assert.throws(() => sanitizePath(undefined), /phải là chuỗi/);
});

// ── sanitizeProfile ───────────────────────────────────────────────────────────

console.log('\n── sanitizeProfile ──────────────────────────────────────────────────');

test('plain profile name is returned as-is', () => {
  assert.strictEqual(sanitizeProfile('default'), 'default');
});

test('double-quoted profile name has quotes stripped', () => {
  assert.strictEqual(sanitizeProfile('"staging"'), 'staging');
});

test('single-quoted profile name has quotes stripped', () => {
  assert.strictEqual(sanitizeProfile("'production'"), 'production');
});

test('profile with forward slash throws (path-like value)', () => {
  assert.throws(() => sanitizeProfile('default/extra'), /không hợp lệ/);
});

test('profile with backslash throws (path-like value)', () => {
  assert.throws(() => sanitizeProfile('default\\extra'), /không hợp lệ/);
});

test('empty profile throws', () => {
  assert.throws(() => sanitizeProfile(''), /không được để trống/);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ─────────────────────────────\n`);

if (failed > 0) {
  process.exit(1);
}
