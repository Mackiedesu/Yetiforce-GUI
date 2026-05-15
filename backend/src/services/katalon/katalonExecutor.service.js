'use strict';

/**
 * katalonExecutor.service.js
 *
 * Runs Katalon Runtime Engine (katalonc.exe) via child_process.spawn.
 * After the process exits, parses the JUnit XML report from the project's
 * Reports/ directory for per-test-case results.
 */

const { spawn }               = require('child_process');
const path                    = require('path');
const { validateKatalonEnv }  = require('../../utils/validateEnv');
const { sanitizePath, sanitizeProfile } = require('../../utils/pathSanitizer');
const { KATALON_API_KEY }     = require('../../config/env');
const { parseKatalonReport }  = require('./reportParser.service');

const SUPPORTED_BROWSERS = ['Chrome', 'Firefox', 'Edge', 'Chrome (headless)', 'Firefox (headless)'];
const SUPPORTED_PROFILES = ['default', 'dev', 'staging', 'production'];

// ── Argument builder ──────────────────────────────────────────────────────────

function buildArgs(config) {
  const projectPath = sanitizePath(config.project_path,  'project_path');
  const suitePath   = sanitizePath(config.suite_path,    'suite_path');
  const profile     = sanitizeProfile(config.profile || 'default');

  console.log('[KatalonExecutor] Sanitized args:');
  console.log(`  project_path : "${projectPath}"`);
  console.log(`  suite_path   : "${suitePath}"`);
  console.log(`  profile      : "${profile}"`);
  console.log(`  browser      : "${config.browser}"`);

  const args = [
    `-projectPath=${projectPath}`,
    `-testSuitePath=${suitePath}`,
    `-browserType=${config.browser}`,
    `-executionProfile=${profile}`,
    '-noSplash',
    '-consoleLog',
  ];

  const apiKey = (config.api_key && config.api_key.trim()) || KATALON_API_KEY;
  if (apiKey) args.push(`-apiKey=${apiKey}`);

  return args;
}

// ── Output parser (summary stats fallback) ────────────────────────────────────

function parseStats(lines) {
  let passed = 0;
  let failed = 0;
  let total  = 0;

  for (const line of lines) {
    const passMatch  = line.match(/PASSED[:\s]+(\d+)/i);
    const failMatch  = line.match(/FAILED[:\s]+(\d+)/i);
    const totalMatch = line.match(/Total[:\s]+(\d+)/i);

    if (passMatch)  passed = parseInt(passMatch[1],  10);
    if (failMatch)  failed = parseInt(failMatch[1],  10);
    if (totalMatch) total  = parseInt(totalMatch[1], 10);
  }

  if (total === 0) total = passed + failed;
  return { passed, failed, total };
}

// ── Watchdog timeouts ─────────────────────────────────────────────────────────

// Kill KRE if it produces no output for this long (catches license-check hangs).
const SILENCE_TIMEOUT_MS = 60_000;        // 60 s

// Hard cap: kill regardless of output (runaway or infinite loop).
const MAX_DURATION_MS = 30 * 60_000;     // 30 min

// ── Main executor ─────────────────────────────────────────────────────────────

/**
 * @param {object} config
 * @param {{ broadcast: Function, runId: string }} ctx
 * @returns {Promise<{
 *   exitCode, duration, lines, error,
 *   passed, failed, total,
 *   skipped, errors,
 *   testCaseDetails, reportPath, parseError
 * }>}
 */
async function executeKatalon(config, { broadcast, runId }) {
  return new Promise((resolve) => {

    // ── 1. Validate suite_path ────────────────────────────────────────────
    if (!config.suite_path || !String(config.suite_path).trim()) {
      const msg = 'suite_path không được để trống. Vui lòng nhập đường dẫn Test Suite.';
      console.error(`[KatalonExecutor] Validation error: ${msg}`);
      broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });
      return resolve({
        exitCode: -1, duration: 0, lines: [], error: msg,
        passed: 0, failed: 0, total: 0, skipped: 0, errors: 0,
        testCaseDetails: [], reportPath: null, parseError: null,
      });
    }

    // ── 2. Determine executable path ──────────────────────────────────────
    const overridePath = config.katalon_executable_path &&
      String(config.katalon_executable_path).trim();
    let execPath;

    if (overridePath) {
      execPath = path.resolve(sanitizePath(overridePath, 'katalon_executable_path'));
      console.log(`[KatalonExecutor] Using per-request executable: "${execPath}"`);
    } else {
      const validation = validateKatalonEnv();
      if (!validation.valid) {
        const msg = `[KatalonExecutor] ${validation.error}`;
        console.error(msg);
        broadcast({ type: 'katalon_log', runId, level: 'error', message: validation.error });
        return resolve({
          exitCode: -1, duration: 0, lines: [], error: validation.error,
          passed: 0, failed: 0, total: 0, skipped: 0, errors: 0,
          testCaseDetails: [], reportPath: null, parseError: null,
        });
      }
      execPath = validation.execPath;
      console.log(`[KatalonExecutor] KATALON_EXECUTABLE_PATH: "${execPath}"`);
    }

    // ── 3. Build args ─────────────────────────────────────────────────────
    let args;
    try {
      args = buildArgs(config);
    } catch (validationErr) {
      const msg = validationErr.message;
      console.error(`[KatalonExecutor] Arg validation failed: ${msg}`);
      broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });
      return resolve({
        exitCode: -1, duration: 0, lines: [], error: msg,
        passed: 0, failed: 0, total: 0, skipped: 0, errors: 0,
        testCaseDetails: [], reportPath: null, parseError: null,
      });
    }

    const displayCmd = `"${execPath}" ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
    console.log(`[KatalonExecutor] Spawning: ${displayCmd}`);
    broadcast({
      type: 'katalon_log', runId, level: 'info',
      message: `▶ Khởi chạy Katalon: ${path.basename(execPath)} ${args.join(' ')}`,
    });

    // ── 4. Spawn ──────────────────────────────────────────────────────────
    const proc = spawn(execPath, args, {
      shell: false,
      windowsHide: true,
      env: { ...process.env },
    });

    const outputLines = [];
    const startTime   = Date.now();
    let   resolved    = false;

    // ── Watchdog: silence timer ───────────────────────────────────────────
    // Resets on every stdout/stderr line; fires if KRE goes silent.
    let silenceTimer = null;

    function resetSilenceTimer() {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        const msg = `Katalon không phản hồi trong ${SILENCE_TIMEOUT_MS / 1000}s (có thể bị treo khi xác thực license). Đang dừng tiến trình.`;
        console.error(`[KatalonExecutor] Silence timeout: ${msg}`);
        broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });
        proc.kill('SIGKILL');
      }, SILENCE_TIMEOUT_MS);
    }

    // ── Watchdog: absolute duration cap ──────────────────────────────────
    const maxTimer = setTimeout(() => {
      const msg = `Katalon đã chạy quá ${MAX_DURATION_MS / 60_000} phút. Đang dừng tiến trình.`;
      console.error(`[KatalonExecutor] Max-duration timeout: ${msg}`);
      broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });
      proc.kill('SIGKILL');
    }, MAX_DURATION_MS);

    function cleanup() {
      clearTimeout(silenceTimer);
      clearTimeout(maxTimer);
    }

    resetSilenceTimer();

    function handleLine(level, raw) {
      const line = raw.trimEnd();
      if (!line) return;
      outputLines.push(line);
      broadcast({ type: 'katalon_log', runId, level, message: line });
      resetSilenceTimer();
    }

    function splitLines(data, level) {
      data.toString().split(/\r?\n/).forEach((l) => handleLine(level, l));
    }

    proc.stdout.on('data', (d) => splitLines(d, 'info'));
    proc.stderr.on('data', (d) => splitLines(d, 'warn'));

    // ── 5. Spawn error ────────────────────────────────────────────────────
    proc.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      cleanup();

      let msg;
      if (err.code === 'ENOENT') {
        msg = `Không tìm thấy Katalon CLI tại: "${execPath}". Kiểm tra lại KATALON_EXECUTABLE_PATH.`;
      } else if (err.code === 'EACCES') {
        msg = `Không có quyền thực thi Katalon CLI tại: "${execPath}".`;
      } else {
        msg = `Lỗi khởi chạy Katalon: ${err.message} (code: ${err.code})`;
      }
      console.error(`[KatalonExecutor] spawn error: ${msg}`);
      broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });

      resolve({
        exitCode: -1, duration: Date.now() - startTime,
        lines: outputLines, error: msg,
        passed: 0, failed: 0, total: 0, skipped: 0, errors: 0,
        testCaseDetails: [], reportPath: null, parseError: null,
      });
    });

    // ── 6. Process exit — parse report ────────────────────────────────────
    proc.on('close', async (code) => {
      if (resolved) return;
      resolved = true;
      cleanup();

      const duration = Date.now() - startTime;

      // Try parsing the JUnit report; always resolve even if parsing fails
      let reportData = { testCases: [], summary: null, reportPath: null, parseError: null };
      try {
        reportData = await parseKatalonReport(config.project_path, startTime);
        if (reportData.parseError) {
          console.warn(`[KatalonExecutor] Report parse warning: ${reportData.parseError}`);
        }
      } catch (parseErr) {
        reportData.parseError = parseErr.message;
        console.warn(`[KatalonExecutor] Report parse exception: ${parseErr.message}`);
      }

      // Use report data for counts when available; fall back to stdout regex
      const fromStdout = parseStats(outputLines);
      const passed = reportData.testCases.length > 0
        ? reportData.testCases.filter((tc) => tc.status === 'PASSED').length
        : fromStdout.passed;
      const failed = reportData.testCases.length > 0
        ? reportData.testCases.filter((tc) => tc.status === 'FAILED').length
        : fromStdout.failed;
      const skipped = reportData.testCases.length > 0
        ? reportData.testCases.filter((tc) => tc.status === 'SKIPPED').length
        : 0;
      const errors = reportData.testCases.length > 0
        ? reportData.testCases.filter((tc) => tc.status === 'ERROR').length
        : 0;
      const total = reportData.testCases.length > 0
        ? reportData.testCases.length
        : fromStdout.total;

      const statusLine = code === 0
        ? `✅ Katalon kết thúc (exit 0) — ${passed}/${total} passed, thời gian ${(duration / 1000).toFixed(1)}s`
        : `❌ Katalon kết thúc (exit ${code}) — ${failed} failures, thời gian ${(duration / 1000).toFixed(1)}s`;

      console.log(`[KatalonExecutor] ${statusLine}`);
      broadcast({
        type: 'katalon_log', runId,
        level: code === 0 ? 'info' : 'error',
        message: statusLine,
      });

      resolve({
        exitCode: code,
        duration,
        lines: outputLines,
        error: null,
        passed,
        failed,
        total,
        skipped,
        errors,
        testCaseDetails: reportData.testCases,
        reportPath:      reportData.reportPath,
        parseError:      reportData.parseError,
      });
    });
  });
}

module.exports = { executeKatalon, SUPPORTED_BROWSERS, SUPPORTED_PROFILES };
