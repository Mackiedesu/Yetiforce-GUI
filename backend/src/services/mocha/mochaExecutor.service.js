'use strict';

/**
 * mochaExecutor.service.js
 *
 * Runs Mocha + Playwright test suites via child_process.spawn.
 * Uses the backend's own node_modules so project folders need no separate npm install.
 *
 *   executeKatalon(config, { broadcast, runId }) → Promise<result>
 */

const { spawn }             = require('child_process');
const path                  = require('path');
const fs                    = require('fs');
const { parseMochaReport }  = require('./mochaReportParser.service');

// ── Constants ─────────────────────────────────────────────────────────────────

const SILENCE_TIMEOUT_MS = 60_000;
const MAX_DURATION_MS    = 30 * 60_000;

const SUPPORTED_BROWSERS = [
  'Chrome', 'Firefox', 'Edge',
  'Chrome (headless)', 'Firefox (headless)',
];
const SUPPORTED_PROFILES = ['default', 'dev', 'staging', 'production'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapBrowser(browser) {
  const b = String(browser || '').toLowerCase();
  if (b.includes('firefox')) return 'firefox';
  return 'chromium';
}

function isHeadless(browser) {
  return String(browser || '').toLowerCase().includes('headless');
}

function resolveSuiteSpec(projectPath, suitePath) {
  const normalized = String(suitePath || '')
    .replace(/\\/g, '/')
    .replace(/^Test Suites\//i, '')
    .replace(/\.ts$/i, '')
    .replace(/^suites\//i, '')
    .replace(/\.spec\.js$/i, '')
    .trim();

  return path.join(projectPath, 'tests', 'suites', `${normalized}.spec.js`);
}

const BACKEND_ROOT         = path.resolve(__dirname, '../../..');
const BACKEND_NODE_MODULES = path.join(BACKEND_ROOT, 'node_modules');
const MOCHA_BIN            = path.join(BACKEND_NODE_MODULES, 'mocha', 'bin', 'mocha.js');
const PLAYWRIGHT_CLI       = path.join(BACKEND_NODE_MODULES, 'playwright', 'cli.js');
const REPORT_FILENAME      = 'mocha-report';

// ── Browser install guard (async) ─────────────────────────────────────────────

// Tracks which browsers have been verified this server session.
const _verifiedBrowsers = new Set();

/**
 * Ensure the Playwright browser binary is installed.
 * Uses async spawn so the Node.js event loop is never blocked — installation
 * progress is streamed to the frontend via broadcast.
 *
 * @returns {Promise<string|null>}  Error message string, or null on success.
 */
function ensurePlaywrightBrowser(browserType, broadcast, runId) {
  if (_verifiedBrowsers.has(browserType)) return Promise.resolve(null);

  broadcast({
    type: 'katalon_log', runId, level: 'info',
    message: `⬇ Playwright browser "${browserType}" chưa được cài đặt — đang tải về (lần đầu chạy)...`,
  });

  return new Promise((resolve) => {
    const proc = spawn(
      'node',
      [PLAYWRIGHT_CLI, 'install', browserType],
      {
        shell:       false,
        windowsHide: true,
        cwd:         BACKEND_ROOT,
        env:         process.env,
      },
    );

    function emit(level, data) {
      data.toString().split(/\r?\n/).forEach((line) => {
        const l = line.trimEnd();
        if (l) broadcast({ type: 'katalon_log', runId, level, message: l });
      });
    }

    proc.stdout.on('data', (d) => emit('info', d));
    proc.stderr.on('data', (d) => emit('info', d)); // playwright writes progress to stderr

    proc.on('error', (err) => {
      resolve(
        `Lỗi khởi chạy playwright install: ${err.message}. ` +
        `Hãy chạy thủ công: cd backend && npx playwright install ${browserType}`,
      );
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(
          `Không thể cài đặt Playwright browser "${browserType}" (exit ${code}). ` +
          `Hãy chạy thủ công: cd backend && npx playwright install ${browserType}`,
        );
      } else {
        _verifiedBrowsers.add(browserType);
        broadcast({
          type: 'katalon_log', runId, level: 'info',
          message: `✅ Playwright browser "${browserType}" đã sẵn sàng.`,
        });
        resolve(null);
      }
    });
  });
}

// ── Mocha spawn ───────────────────────────────────────────────────────────────

function spawnMocha(config, { broadcast, runId, specFile, reportDir, browserType, headless }) {
  return new Promise((resolve) => {
    const timeout = Number(config.timeout_ms) || 30_000;
    const args = [
      MOCHA_BIN,
      specFile,
      '--reporter',         'mochawesome',
      '--reporter-options', [
        `reportDir=${reportDir}`,
        `reportFilename=${REPORT_FILENAME}`,
        'quiet=true',
        'overwrite=true',
        'charts=false',
      ].join(','),
      '--timeout',  String(timeout),
      '--no-color',
      '--exit',
    ];

    broadcast({
      type: 'katalon_log', runId, level: 'info',
      message: `▶ Khởi chạy Mocha: ${path.basename(specFile)}`,
    });
    broadcast({
      type: 'katalon_log', runId, level: 'info',
      message: `  Browser: ${config.browser || 'Chrome'} (${browserType}${headless ? ', headless' : ''})`,
    });
    broadcast({
      type: 'katalon_log', runId, level: 'info',
      message: `  Spec: ${specFile}`,
    });

    const proc = spawn('node', args, {
      shell:       false,
      windowsHide: true,
      cwd:         config.project_path,
      env: {
        ...process.env,
        NODE_PATH:     BACKEND_NODE_MODULES,
        TEST_BROWSER:  browserType,
        TEST_HEADLESS: headless ? 'true' : 'false',
        TEST_PROFILE:  config.profile || 'default',
        FORCE_COLOR:   '0',
      },
    });

    const outputLines = [];
    const startTime   = Date.now();
    let   resolved    = false;

    let silenceTimer = null;
    function resetSilenceTimer() {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        const msg =
          `Mocha không phản hồi trong ${SILENCE_TIMEOUT_MS / 1000}s ` +
          '(browser có thể treo hoặc page không load được). Đang dừng tiến trình.';
        console.error(`[MochaExecutor] Silence timeout`);
        broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });
        proc.kill('SIGKILL');
      }, SILENCE_TIMEOUT_MS);
    }

    const maxTimer = setTimeout(() => {
      const msg = `Mocha đã chạy quá ${MAX_DURATION_MS / 60_000} phút. Đang dừng tiến trình.`;
      console.error(`[MochaExecutor] Max-duration timeout`);
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

    proc.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      const msg = `Lỗi khởi chạy Mocha: ${err.message} (code: ${err.code})`;
      console.error(`[MochaExecutor] spawn error: ${msg}`);
      broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });
      resolve({ ...errorResult(msg), duration: Date.now() - startTime, lines: outputLines });
    });

    proc.on('close', async (code) => {
      if (resolved) return;
      resolved = true;
      cleanup();

      const duration = Date.now() - startTime;

      let reportData = { testCases: [], summary: null, reportPath: null, parseError: null };
      try {
        reportData = await parseMochaReport(reportDir, REPORT_FILENAME);
        if (reportData.parseError) {
          console.warn(`[MochaExecutor] Report parse warning: ${reportData.parseError}`);
        }
      } catch (parseErr) {
        reportData.parseError = parseErr.message;
        console.warn(`[MochaExecutor] Report parse exception: ${parseErr.message}`);
      }

      const passed  = reportData.testCases.filter((t) => t.status === 'PASSED').length;
      const failed  = reportData.testCases.filter((t) => t.status === 'FAILED').length;
      const skipped = reportData.testCases.filter((t) => t.status === 'SKIPPED').length;
      const errors  = reportData.testCases.filter((t) => t.status === 'ERROR').length;
      const total   = reportData.testCases.length || (passed + failed + skipped + errors);

      const statusLine = code === 0
        ? `✅ Mocha kết thúc (exit 0) — ${passed}/${total} passed, ${(duration / 1000).toFixed(1)}s`
        : `❌ Mocha kết thúc (exit ${code}) — ${failed} failure(s), ${(duration / 1000).toFixed(1)}s`;

      console.log(`[MochaExecutor] ${statusLine}`);
      broadcast({
        type: 'katalon_log', runId,
        level: code === 0 ? 'info' : 'error',
        message: statusLine,
      });

      resolve({
        exitCode:        code,
        duration,
        lines:           outputLines,
        error:           null,
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

// ── Main executor ─────────────────────────────────────────────────────────────

/**
 * Execute a Mocha test suite and stream output via broadcast.
 *
 * @param {object}   config
 * @param {Function} ctx.broadcast   WebSocket broadcaster fn
 * @param {string}   ctx.runId       Execution run UUID
 * @returns {Promise<ExecutionResult>}
 */
async function executeKatalon(config, { broadcast, runId }) {

  // ── 1. Validate suite_path ────────────────────────────────────────────────
  if (!config.suite_path || !String(config.suite_path).trim()) {
    const msg = 'suite_path không được để trống. Vui lòng chọn một Test Suite.';
    broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });
    return errorResult(msg);
  }

  const projectPath = String(config.project_path || '').trim();
  const specFile    = resolveSuiteSpec(projectPath, config.suite_path);
  const reportDir   = path.join(projectPath, 'reports');

  // ── 2. Ensure spec file exists ────────────────────────────────────────────
  if (!fs.existsSync(specFile)) {
    const msg =
      `Không tìm thấy file spec: "${specFile}". ` +
      'Hãy đảm bảo Test Suite đã được tạo đúng cách hoặc chọn suite khác.';
    broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });
    return errorResult(msg);
  }

  // ── 3. Ensure mocha binary exists ─────────────────────────────────────────
  if (!fs.existsSync(MOCHA_BIN)) {
    const msg =
      `Không tìm thấy Mocha binary tại: "${MOCHA_BIN}". ` +
      'Chạy "npm install" trong thư mục backend.';
    broadcast({ type: 'katalon_log', runId, level: 'error', message: msg });
    return errorResult(msg);
  }

  fs.mkdirSync(reportDir, { recursive: true });

  const browserType = mapBrowser(config.browser);
  const headless    = isHeadless(config.browser);

  // ── 4. Ensure Playwright browser is installed (async — never blocks the loop)
  const installErr = await ensurePlaywrightBrowser(browserType, broadcast, runId);
  if (installErr) {
    broadcast({ type: 'katalon_log', runId, level: 'error', message: installErr });
    return errorResult(installErr);
  }

  // ── 5. Spawn Mocha ────────────────────────────────────────────────────────
  return spawnMocha(config, { broadcast, runId, specFile, reportDir, browserType, headless });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function errorResult(msg) {
  return {
    exitCode: -1, duration: 0, lines: [], error: msg,
    passed: 0, failed: 0, total: 0, skipped: 0, errors: 0,
    testCaseDetails: [], reportPath: null, parseError: null,
  };
}

module.exports = { executeKatalon, SUPPORTED_BROWSERS, SUPPORTED_PROFILES };
