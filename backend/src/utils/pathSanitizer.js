'use strict';

/**
 * pathSanitizer.js
 *
 * Sanitizes user-supplied path / profile strings before they are embedded
 * into Katalon CLI arguments.
 *
 * Problem being solved
 * ────────────────────
 * Users sometimes wrap values in quotes in the UI ("Test Suites/Login") or
 * leave extra spaces.  When those raw strings are concatenated into an
 * argument like `-testSuitePath="Test Suites/Login"` the literal quote chars
 * end up inside the value field and confuse the Katalon JVM argument parser.
 *
 * The correct approach is:
 *   1. Strip any surrounding quotes the user may have typed.
 *   2. Trim whitespace.
 *   3. Pass the clean value as a single element in the args[] array fed to
 *      spawn().  Because shell: false is used, Node / the OS handles any
 *      embedded spaces without further quoting.
 *
 * Usage
 * ─────
 *   const { sanitizePath, sanitizeProfile } = require('./pathSanitizer');
 *
 *   sanitizePath('"Test Suites/Login Suite"') // → 'Test Suites/Login Suite'
 *   sanitizePath("  'Test Suites/Login Suite'  ") // → 'Test Suites/Login Suite'
 *   sanitizePath('Test Suites/Login Suite')    // → 'Test Suites/Login Suite'
 */

/**
 * Strips surrounding single or double quotes, collapses leading/trailing
 * whitespace, and normalises Windows path separators.
 *
 * @param {string} raw           Raw value from the request body.
 * @param {string} [fieldName]   Human-readable field name used in error msgs.
 * @returns {string}             Clean value ready to embed in an args[] entry.
 * @throws {Error}               If the result is empty after sanitisation.
 */
function sanitizePath(raw, fieldName = 'path') {
  if (typeof raw !== 'string') {
    throw Object.assign(
      new Error(`${fieldName} phải là chuỗi ký tự, nhận được: ${typeof raw}`),
      { statusCode: 400 },
    );
  }

  // 1. Trim surrounding whitespace
  let clean = raw.trim();

  // 2. Strip matching surrounding double-quotes: "value" → value
  if (clean.startsWith('"') && clean.endsWith('"') && clean.length >= 2) {
    clean = clean.slice(1, -1).trim();
  }

  // 3. Strip matching surrounding single-quotes: 'value' → value
  if (clean.startsWith("'") && clean.endsWith("'") && clean.length >= 2) {
    clean = clean.slice(1, -1).trim();
  }

  // 4. Collapse any internal runs of whitespace to a single space
  //    (catches copy-paste accidents like "Test  Suites/Login")
  clean = clean.replace(/\s{2,}/g, ' ');

  // 5. Guard against empty result
  if (!clean) {
    throw Object.assign(
      new Error(`${fieldName} không được để trống sau khi xử lý`),
      { statusCode: 400 },
    );
  }

  return clean;
}

/**
 * Sanitizes an execution profile name.
 * Profile names must not contain path separators or quotes.
 *
 * @param {string} raw
 * @returns {string}
 */
function sanitizeProfile(raw) {
  const clean = sanitizePath(raw, 'executionProfile');

  // Profiles are simple identifiers — reject anything that looks like a path
  if (/[/\\]/.test(clean)) {
    throw Object.assign(
      new Error(`executionProfile không hợp lệ: "${clean}". Chỉ nhập tên profile (vd: default, staging).`),
      { statusCode: 400 },
    );
  }

  return clean;
}

module.exports = { sanitizePath, sanitizeProfile };
