'use strict';

/**
 * reportParser.service.js
 *
 * Parses Katalon Runtime Engine execution reports (JUnit XML) after a run.
 * Works for both PASSED and FAILED executions.
 *
 * Katalon report folder layout:
 *   <projectPath>/Reports/<date>/<SuiteName>/<timestamp>/JUnit_Report.xml
 *
 * Strategy:
 *   1. Find the most-recently-touched subfolder inside Reports/ that was
 *      touched after the execution started.
 *   2. Recursively search that folder for a JUnit XML file.
 *   3. Parse <testcase> elements — handle both self-closing and pair tags.
 *   4. Return a structured result; never throw (always return { parseError }).
 */

const fs   = require('fs');
const path = require('path');

// ── XML helpers ───────────────────────────────────────────────────────────────

function getAttr(attrStr, attrName) {
  const dq = attrStr.match(new RegExp(`${attrName}="([^"]*)"`));
  if (dq) return dq[1];
  const sq = attrStr.match(new RegExp(`${attrName}='([^']*)'`));
  return sq ? sq[1] : '';
}

// ── JUnit XML parser ──────────────────────────────────────────────────────────

function parseJUnitXML(xmlContent) {
  const testCases = [];

  // Strip XML comments to avoid false matches
  const clean = xmlContent.replace(/<!--[\s\S]*?-->/g, '');

  // Match <testcase .../> (self-closing) and <testcase ...>...</testcase>
  const tcRegex = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/gi;
  let m;

  while ((m = tcRegex.exec(clean)) !== null) {
    const attrs  = m[1];
    const inner  = m[2] || '';

    const name       = getAttr(attrs, 'name');
    const classname  = getAttr(attrs, 'classname');
    const timeStr    = getAttr(attrs, 'time');
    const statusAttr = getAttr(attrs, 'status');

    const durationMs = timeStr ? Math.round(parseFloat(timeStr) * 1000) : 0;

    let status       = statusAttr ? statusAttr.toUpperCase() : 'PASSED';
    let errorMessage = null;
    let stackTrace   = null;

    // <failure message="...">stack</failure>
    const failM = inner.match(/<failure\b[^>]*?(?:message="([^"]*)")?[^>]*>([\s\S]*?)<\/failure>/i);
    // <error message="...">stack</error>
    const errM  = inner.match(/<error\b[^>]*?(?:message="([^"]*)")?[^>]*>([\s\S]*?)<\/error>/i);

    if (failM) {
      status       = 'FAILED';
      errorMessage = failM[1] || null;
      stackTrace   = (failM[2] || '').trim() || null;
    } else if (errM) {
      status       = 'ERROR';
      errorMessage = errM[1] || null;
      stackTrace   = (errM[2] || '').trim() || null;
    } else if (/<skipped/i.test(inner)) {
      status = 'SKIPPED';
    }

    testCases.push({
      test_case_name: name || classname,
      duration_ms:    durationMs,
      status,
      error_message:  errorMessage,
      stack_trace:    stackTrace,
    });
  }

  return testCases;
}

function parseSuiteHeader(xmlContent) {
  const m = xmlContent.match(/<testsuite\b([^>]*?)(?:\/>|>)/i);
  if (!m) return null;
  const a = m[1];
  return {
    name:     getAttr(a, 'name'),
    tests:    parseInt(getAttr(a, 'tests')    || '0', 10),
    failures: parseInt(getAttr(a, 'failures') || '0', 10),
    errors:   parseInt(getAttr(a, 'errors')   || '0', 10),
    skipped:  parseInt(getAttr(a, 'skipped')  || '0', 10),
    time:     parseFloat(getAttr(a, 'time')   || '0'),
  };
}

// ── Report folder finder ──────────────────────────────────────────────────────

/**
 * Walk <projectPath>/Reports/ up to depth 5 and collect every directory
 * whose mtime is >= (startTime - 60 s).  Return the most-recently-touched one.
 */
function findLatestReportFolder(projectPath, startTime) {
  const reportsDir = path.join(projectPath, 'Reports');
  if (!fs.existsSync(reportsDir)) return null;

  const candidates = [];

  function walk(dir, depth) {
    if (depth > 5) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const full = path.join(dir, e.name);
      try {
        const stat = fs.statSync(full);
        // Accept any folder touched within 60 s before execution started
        if (stat.mtimeMs >= startTime - 60_000) {
          candidates.push({ fullPath: full, mtime: stat.mtimeMs });
        }
      } catch { /* ignore */ }
      walk(full, depth + 1);
    }
  }

  walk(reportsDir, 0);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0].fullPath;
}

/**
 * Recursively search for a JUnit XML file inside a folder.
 * Matches filenames containing "junit" or exactly "output.xml" (Katalon v8+).
 */
function findJUnitXML(folder) {
  if (!folder || !fs.existsSync(folder)) return null;

  function search(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }

    for (const e of entries) {
      const full  = path.join(dir, e.name);
      const lower = e.name.toLowerCase();
      if (e.isFile() && lower.endsWith('.xml') &&
          (lower.includes('junit') || lower === 'output.xml')) {
        return full;
      }
      if (e.isDirectory()) {
        const found = search(full);
        if (found) return found;
      }
    }
    return null;
  }

  return search(folder);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse the Katalon execution report after a run finishes.
 *
 * @param {string} projectPath  Absolute path to the Katalon project root.
 * @param {number} startTime    Date.now() recorded just before spawning katalonc.
 * @returns {{ testCases, summary, reportPath, parseError }}
 *   testCases  — array of { test_case_name, duration_ms, status,
 *                            error_message, stack_trace }
 *   summary    — { name, tests, failures, errors, skipped, time } from <testsuite>
 *   reportPath — absolute path to the report folder (or null)
 *   parseError — human-readable reason if parsing failed (or null on success)
 */
async function parseKatalonReport(projectPath, startTime) {
  try {
    if (!projectPath) {
      return { testCases: [], summary: null, reportPath: null, parseError: 'No project path provided' };
    }

    const reportFolder = findLatestReportFolder(projectPath, startTime);
    if (!reportFolder) {
      return {
        testCases: [], summary: null, reportPath: null,
        parseError: 'Report folder not found — Katalon may not have generated a report',
      };
    }

    const xmlPath = findJUnitXML(reportFolder);
    if (!xmlPath) {
      return {
        testCases: [], summary: null, reportPath: reportFolder,
        parseError: 'JUnit XML not found inside report folder',
      };
    }

    const xmlContent  = fs.readFileSync(xmlPath, 'utf8');
    const testCases   = parseJUnitXML(xmlContent);
    const summary     = parseSuiteHeader(xmlContent);

    return { testCases, summary, reportPath: reportFolder, parseError: null };
  } catch (err) {
    return {
      testCases: [], summary: null, reportPath: null,
      parseError: `Parse error: ${err.message}`,
    };
  }
}

module.exports = { parseKatalonReport };
