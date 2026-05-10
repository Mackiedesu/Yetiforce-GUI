'use strict';

/**
 * katalonExecutor.service.js
 *
 * Runs Katalon Runtime Engine (katalonc.exe) via child_process.spawn.
 *
 * Key design decisions
 * ────────────────────
 * • KATALON_EXECUTABLE_PATH is read from process.env at call-time so dotenv
 *   changes are always reflected without restarting the module.
 * • All user-supplied paths are sanitized via pathSanitizer before being
 *   embedded into args[].  Users no longer need to manually wrap paths in
 *   quotes — the sanitizer strips any quotes they may have typed.
 * • spawn() receives args as a string[] (never a single shell string), so
 *   spaces inside values (e.g. "Test Suites/Login Suite") are handled
 *   natively by Node/the OS without any shell quoting tricks.
 * • shell: false on Windows avoids cmd.exe quoting pitfalls for the
 *   executable itself.
 */

const { spawn }               = require('child_process');
const path                    = require('path');
const { validateKatalonEnv }  = require('../../utils/validateEnv');
const { sanitizePath, sanitizeProfile } = require('../../utils/pathSanitizer');
const { KATALON_API_KEY }     = require('../../config/env');

const SUPPORTED_BROWSERS = ['Chrome', 'Firefox', 'Edge', 'Chrome (headless)', 'Firefox (headless)'];
const SUPPORTED_PROFILES = ['default', 'dev', 'staging', 'production'];

// ── Argument builder ──────────────────────────────────────────────────────────

/**
 * Builds the args[] array for spawn().
 *
 * WHY sanitize here and not only at the controller layer?
 * This function is the last point before values touch the OS, so it acts as a
 * defence-in-depth safety net even if the caller forgot to sanitize.
 *
 * Each element becomes one token passed to the Katalon JVM.  Because we use
 * shell: false, Node does NOT invoke cmd.exe and does NOT interpret quotes —
 * `"Test Suites/Login"` as a raw string would literally pass the quote chars
 * to Katalon.  The sanitizer removes them so the value is clean.
 */
function buildArgs(config) {
  // Sanitize every path/profile value unconditionally
  const projectPath = sanitizePath(config.project_path,  'project_path');
  const suitePath   = sanitizePath(config.suite_path,    'suite_path');
  const profile     = sanitizeProfile(config.profile || 'default');

  console.log('[KatalonExecutor] Sanitized args:');
  console.log(`  project_path  : "${projectPath}"`);
  console.log(`  suite_path    : "${suitePath}"`);
  console.log(`  profile       : "${profile}"`);
  console.log(`  browser       : "${config.browser}"`);

  const args = [
    `-projectPath=${projectPath}`,
    `-testSuitePath=${suitePath}`,
    `-browserType=${config.browser}`,
    `-executionProfile=${profile}`,
    '-noSplash',
    '-consoleLog',
  ];

  // Prefer per-request api_key, then env fallback
  const apiKey = (config.api_key && config.api_key.trim()) || KATALON_API_KEY;
  if (apiKey) {
    args.push(`-apiKey=${apiKey}`);
  }

  return args;
}

// ── Output parser ─────────────────────────────────────────────────────────────

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

// ── Main executor ─────────────────────────────────────────────────────────────

/**
 * @param {object} config
 *   config.katalon_executable_path  – optional per-request override
 *   config.project_path             – required; may contain spaces
 *   config.suite_path               – required; may contain spaces / quotes
 *   config.browser                  – e.g. 'Chrome'
 *   config.profile                  – e.g. 'default'
 *   config.api_key                  – optional per-request override
 * @param {{ broadcast: Function, runId: string }} ctx
 * @returns {Promise<{ exitCode: number, duration: number, lines: string[],
 *                     error: string|null, passed: number, failed: number,
 *                     total: number }>}
 */
async function executeKatalon(config, { broadcast, runId }) {
  return new Promise((resolve) => {

    // ── 1. Validate suite_path before going any further ───────────────────
    if (!config.suite_path || !String(config.suite_path).trim()) {
      const msg = 'suite_path không được để trống. Vui lòng nhập đường dẫn Test Suite.';
      console.error(`[KatalonExecutor] Validation error: ${msg}`);
      broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });
      return resolve({ exitCode: -1, duration: 0, lines: [], error: msg, passed: 0, failed: 0, total: 0 });
    }

    // ── 2. Determine the executable path ──────────────────────────────────
    const overridePath = config.katalon_executable_path &&
      String(config.katalon_executable_path).trim();

    let execPath;

    if (overridePath) {
      // Caller supplied an explicit path — sanitize & resolve it
      execPath = path.resolve(sanitizePath(overridePath, 'katalon_executable_path'));
      console.log(`[KatalonExecutor] Using per-request executable path: "${execPath}"`);
    } else {
      // Read from environment (dotenv-backed, lazy)
      const validation = validateKatalonEnv();

      if (!validation.valid) {
        const msg = `[KatalonExecutor] ${validation.error}`;
        console.error(msg);
        broadcast({ type: 'katalon_log', runId, level: 'error', message: validation.error });
        return resolve({
          exitCode: -1, duration: 0, lines: [], error: validation.error,
          passed: 0, failed: 0, total: 0,
        });
      }

      execPath = validation.execPath;
      console.log(`[KatalonExecutor] KATALON_EXECUTABLE_PATH resolved to: "${execPath}"`);
    }

    // ── 3. Build sanitized argument list ──────────────────────────────────
    let args;
    try {
      args = buildArgs(config);
    } catch (validationErr) {
      const msg = validationErr.message;
      console.error(`[KatalonExecutor] Argument validation failed: ${msg}`);
      broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });
      return resolve({ exitCode: -1, duration: 0, lines: [], error: msg, passed: 0, failed: 0, total: 0 });
    }

    // Log the exact command that will be spawned (sanitized, no literal quotes)
    const displayCmd = `"${execPath}" ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
    console.log(`[KatalonExecutor] Spawning: ${displayCmd}`);
    broadcast({
      type: 'katalon_log',
      runId,
      level: 'info',
      message: `▶ Khởi chạy Katalon: ${path.basename(execPath)} ${args.join(' ')}`,
    });

    // ── 4. Spawn the process ──────────────────────────────────────────────
    //
    // IMPORTANT: shell: false means Node passes the args[] directly to the OS
    // without invoking cmd.exe.  Spaces inside individual args[] elements are
    // handled natively — no extra shell quoting is needed or wanted.
    //
    const proc = spawn(execPath, args, {
      shell: false,
      windowsHide: true,
      env: { ...process.env },
    });

    const outputLines = [];
    const startTime   = Date.now();

    function handleLine(level, raw) {
      const line = raw.trimEnd();
      if (!line) return;
      outputLines.push(line);
      broadcast({ type: 'katalon_log', runId, level, message: line });
    }

    function splitLines(data, level) {
      data.toString().split(/\r?\n/).forEach((l) => handleLine(level, l));
    }

    proc.stdout.on('data', (d) => splitLines(d, 'info'));
    proc.stderr.on('data', (d) => splitLines(d, 'warn'));

    // ── 5. Handle spawn errors ────────────────────────────────────────────
    proc.on('error', (err) => {
      let msg;
      if (err.code === 'ENOENT') {
        msg = `Không tìm thấy Katalon CLI tại: "${execPath}". Kiểm tra lại KATALON_EXECUTABLE_PATH trong .env hoặc tham số katalon_executable_path.`;
      } else if (err.code === 'EACCES') {
        msg = `Không có quyền thực thi Katalon CLI tại: "${execPath}". Vui lòng kiểm tra quyền file.`;
      } else {
        msg = `Lỗi khởi chạy tiến trình Katalon: ${err.message} (code: ${err.code})`;
      }

      console.error(`[KatalonExecutor] spawn error: ${msg}`);
      broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });

      const duration = Date.now() - startTime;
      resolve({ exitCode: -1, duration, lines: outputLines, error: msg, passed: 0, failed: 0, total: 0 });
    });

    // ── 6. Handle process exit ────────────────────────────────────────────
    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      const { passed, failed, total } = parseStats(outputLines);

      const statusLine = code === 0
        ? `✅ Katalon kết thúc (exit 0) — ${passed}/${total} passed, thời gian ${(duration / 1000).toFixed(1)}s`
        : `❌ Katalon kết thúc (exit ${code}) — ${failed} failures, thời gian ${(duration / 1000).toFixed(1)}s`;

      console.log(`[KatalonExecutor] ${statusLine}`);
      broadcast({
        type: 'katalon_log',
        runId,
        level: code === 0 ? 'info' : 'error',
        message: statusLine,
      });

      resolve({ exitCode: code, duration, lines: outputLines, error: null, passed, failed, total });
    });
  });
}

module.exports = { executeKatalon, SUPPORTED_BROWSERS, SUPPORTED_PROFILES };
