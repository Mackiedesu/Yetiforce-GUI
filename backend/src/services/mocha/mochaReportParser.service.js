'use strict';

/**
 * mochaReportParser.service.js
 *
 * Parses a mochawesome JSON report written by the Mocha test runner.
 * Returns the same structure expected by execution.controller.js and
 * execution.repository.pg.js so no downstream code needs to change.
 *
 * Mochawesome JSON shape:
 *   { stats: { tests, passes, failures, pending, duration },
 *     results: [ { suites: [ { title, tests: [ testObj ], suites: [...] } ] } ] }
 *
 * testObj shape:
 *   { fullTitle, title, duration, pass, fail, pending, skipped,
 *     err: { message, estack } }
 */

const fs   = require('fs');
const path = require('path');

// ── Walk mochawesome result tree ──────────────────────────────────────────────

function testToEntry(t, defaultStatus = 'PASSED') {
  let status = defaultStatus;
  let errorMessage = null;
  let stackTrace   = null;

  if (t.fail || t.state === 'failed') {
    status       = 'FAILED';
    errorMessage = t.err?.message || null;
    stackTrace   = t.err?.estack  || null;
  } else if (t.pending || t.skipped || t.state === 'pending') {
    status = 'SKIPPED';
  }

  return {
    test_case_name: t.fullTitle || t.title || 'Unknown',
    duration_ms:    typeof t.duration === 'number' ? t.duration : 0,
    status,
    error_message:  errorMessage,
    stack_trace:    stackTrace,
  };
}

function collectTests(node, out) {
  // Regular test cases
  for (const t of (node.tests || [])) {
    out.push(testToEntry(t));
  }

  // Hook failures (beforeHooks / afterHooks) — mochawesome stores them separately.
  // A before/after hook failure means no tests ran; surface it as an ERROR entry
  // so the UI shows something meaningful rather than "no data".
  for (const hook of [...(node.beforeHooks || []), ...(node.afterHooks || [])]) {
    if (hook.fail || hook.state === 'failed') {
      out.push({
        test_case_name: hook.fullTitle || hook.title || 'Hook failure',
        duration_ms:    typeof hook.duration === 'number' ? hook.duration : 0,
        status:         'ERROR',
        error_message:  hook.err?.message || null,
        stack_trace:    hook.err?.estack  || null,
      });
    }
  }

  for (const child of (node.suites || [])) {
    collectTests(child, out);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a mochawesome JSON report from disk.
 *
 * @param {string} reportDir       Directory where mochawesome writes reports.
 * @param {string} reportFilename  Base filename (no extension), default 'mocha-report'.
 * @returns {{ testCases, summary, reportPath, parseError }}
 */
async function parseMochaReport(reportDir, reportFilename = 'mocha-report') {
  try {
    const jsonPath = path.join(reportDir, `${reportFilename}.json`);

    if (!fs.existsSync(jsonPath)) {
      return {
        testCases:  [],
        summary:    null,
        reportPath: null,
        parseError: `Mochawesome JSON không tìm thấy tại: "${jsonPath}"`,
      };
    }

    const raw    = fs.readFileSync(jsonPath, 'utf8');
    const report = JSON.parse(raw);

    const testCases = [];
    for (const result of (report.results || [])) {
      collectTests(result, testCases);
    }

    const s = report.stats || {};
    const summary = {
      name:     'Mocha Test Suite',
      tests:    s.tests    ?? testCases.length,
      failures: s.failures ?? 0,
      errors:   0,
      skipped:  s.pending  ?? 0,
      time:     typeof s.duration === 'number' ? s.duration / 1000 : 0,
    };

    return { testCases, summary, reportPath: reportDir, parseError: null };
  } catch (err) {
    return {
      testCases:  [],
      summary:    null,
      reportPath: null,
      parseError: `Parse error: ${err.message}`,
    };
  }
}

module.exports = { parseMochaReport };
