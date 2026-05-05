const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const SCREENSHOTS_DIR = path.join(REPORTS_DIR, 'screenshots');

// Đảm bảo thư mục tồn tại
function ensureDirs() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Bọc script do AI sinh ra bên trong wrapper template có:
 * - Thu thập environment info
 * - Screenshot-on-fail
 * - Step logging qua stdout JSON-line
 */
function wrapScript(originalScript, runId) {
  const screenshotDir = SCREENSHOTS_DIR.replace(/\\/g, '\\\\');
  
  // Wrapper template inject vào đầu script
  const wrapperHeader = `
// ============= QA STUDIO ENHANCED WRAPPER =============
const __fs = require('fs');
const __path = require('path');
const __os = require('os');

const __runId = '${runId}';
const __screenshotDir = '${screenshotDir}';
const __stepLogs = [];
let __envInfo = {};
let __testStartTime = Date.now();

// Hàm log step ra stdout dạng JSON-line cho backend parse
function __logEvent(event, data) {
  const msg = JSON.stringify({ __qaStudioEvent: true, event, ...data, timestamp: new Date().toISOString() });
  process.stdout.write(msg + '\\n');
}

// Hàm log step vào bộ nhớ
function __logStep(action, status, duration, error) {
  const step = { action, status, duration: duration || 0, timestamp: new Date().toISOString() };
  if (error) step.error = error;
  __stepLogs.push(step);
  __logEvent('step', step);
}

// Thu thập environment info
function __collectEnv(driver) {
  return driver.getCapabilities().then(caps => {
    __envInfo = {
      browser: caps.get('browserName') + ' ' + (caps.get('browserVersion') || ''),
      os: __os.type() + ' ' + __os.release(),
      platform: __os.platform(),
      arch: __os.arch(),
      nodeVersion: process.version,
      startTime: new Date(__testStartTime).toISOString()
    };
    __logEvent('env_collected', __envInfo);
    return __envInfo;
  }).catch(() => {
    __envInfo = {
      browser: 'Unknown',
      os: __os.type() + ' ' + __os.release(),
      platform: __os.platform(),
      arch: __os.arch(),
      nodeVersion: process.version,
      startTime: new Date(__testStartTime).toISOString()
    };
    return __envInfo;
  });
}

// Override global hooks cho screenshot-on-fail
// Biến này sẽ được set trong before()
let __activeDriver = null;
`;

  // Tìm dòng `before(async function()` để inject env collection
  // Và thêm afterEach cho screenshot-on-fail
  let modifiedScript = originalScript;

  // Inject sau dòng `driver = await new Builder()...build();`
  // Tìm pattern: driver = await new Builder()
  const builderPattern = /driver\s*=\s*await\s+new\s+Builder\(\)[^;]*\.build\(\)\s*;/;
  const builderMatch = modifiedScript.match(builderPattern);
  
  if (builderMatch) {
    const afterBuilder = `
    __activeDriver = driver;
    await __collectEnv(driver);
    __logEvent('test_suite_start', { title: 'Test Suite' });
`;
    modifiedScript = modifiedScript.replace(builderMatch[0], builderMatch[0] + afterBuilder);
  }

  // Inject afterEach cho screenshot-on-fail trước after()
  const afterPattern = /after\s*\(\s*async\s+function\s*\(\)\s*\{/;
  const afterMatch = modifiedScript.match(afterPattern);
  
  if (afterMatch) {
    const testHooks = `
  beforeEach(function() {
    __logEvent('test_case_start', { title: this.currentTest.title });
  });

  afterEach(async function() {
    const test = this.currentTest;
    if (test) {
      if (test.state === 'passed') {
        __logEvent('test_case_pass', { title: test.title, duration: test.duration });
        __logStep(test.title, 'passed', test.duration);
      } else if (test.state === 'failed') {
        const errMsg = test.err ? test.err.message : 'Unknown error';
        __logEvent('test_case_fail', { title: test.title, duration: test.duration, error: errMsg });
        __logStep(test.title, 'failed', test.duration, errMsg);
        // Screenshot-on-fail
        if (__activeDriver) {
          try {
            const screenshot = await __activeDriver.takeScreenshot();
            const filename = __runId + '_fail_' + Date.now() + '.png';
            __fs.writeFileSync(__path.join(__screenshotDir, filename), screenshot, 'base64');
            __logEvent('screenshot_captured', { filename, testTitle: test.title });
          } catch(e) { /* ignore screenshot errors */ }
        }
      }
    }
  });

  `;
    modifiedScript = modifiedScript.replace(afterMatch[0], testHooks + afterMatch[0]);
  }

  // Inject vào after() hook để gửi summary khi kết thúc
  const afterBody = /after\s*\(\s*async\s+function\s*\(\)\s*\{/;
  const afterBodyMatch = modifiedScript.match(afterBody);
  if (afterBodyMatch) {
    const summaryCode = `
    __envInfo.endTime = new Date().toISOString();
    __envInfo.duration = Date.now() - __testStartTime;
    __logEvent('test_suite_end', { environment: __envInfo, steps: __stepLogs });
`;
    modifiedScript = modifiedScript.replace(
      afterBodyMatch[0],
      afterBodyMatch[0] + summaryCode
    );
  }

  return wrapperHeader + '\n' + modifiedScript;
}

/**
 * Chạy test với tính năng nâng cao
 * @param {string} scriptContent - Mã nguồn test script
 * @param {Function} wsBroadcast - Hàm broadcast WebSocket
 * @returns {Promise<Object>} Kết quả test đầy đủ
 */
async function runEnhancedTest(scriptContent, wsBroadcast) {
  ensureDirs();

  const runId = `run_${Date.now()}`;
  const testsDir = path.join(__dirname, '..', 'tmp_tests');
  if (!fs.existsSync(testsDir)) fs.mkdirSync(testsDir, { recursive: true });

  // Bọc script
  const wrappedScript = wrapScript(scriptContent, runId);
  const filename = `test_${runId}.test.js`;
  const filePath = path.join(testsDir, filename);
  fs.writeFileSync(filePath, wrappedScript);

  const reportFilename = `report_${runId}`;
  
  // Broadcast: test bắt đầu
  broadcast(wsBroadcast, {
    type: 'test_progress',
    event: 'run_start',
    runId,
    timestamp: new Date().toISOString()
  });

  return new Promise((resolve) => {
    const mochaCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const args = [
      'mocha', filePath,
      '--reporter', 'mochawesome',
      '--reporter-options',
      `reportDir=${REPORTS_DIR},reportFilename=${reportFilename},html=true,json=true`,
      '--timeout', '60000'
    ];

    const child = spawn(mochaCmd, args, {
      cwd: path.join(__dirname, '..'),
      shell: true,
      env: { ...process.env }
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let environment = {};
    let steps = [];
    let screenshots = [];
    let testResults = [];

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdoutBuffer += text;

      // Parse JSON-line events từ wrapper
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.__qaStudioEvent) {
            handleRealtimeEvent(parsed, wsBroadcast, runId, {
              environment, steps, screenshots, testResults
            });

            // Cập nhật local state
            if (parsed.event === 'env_collected') {
              Object.assign(environment, parsed);
              delete environment.__qaStudioEvent;
              delete environment.event;
              delete environment.timestamp;
            }
            if (parsed.event === 'step') {
              steps.push(parsed);
            }
            if (parsed.event === 'screenshot_captured') {
              screenshots.push(parsed.filename);
            }
          }
        } catch (e) {
          // Không phải JSON — là output bình thường của Mocha
        }
      }
    });

    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    child.on('close', (code) => {
      // Parse mochawesome JSON report
      let mochawesomeReport = null;
      const jsonReportPath = path.join(REPORTS_DIR, `${reportFilename}.json`);
      try {
        if (fs.existsSync(jsonReportPath)) {
          mochawesomeReport = JSON.parse(fs.readFileSync(jsonReportPath, 'utf-8'));
        }
      } catch (e) {
        console.error('Lỗi đọc mochawesome report:', e.message);
      }

      // Xây dựng enhanced report
      const enhancedReport = buildEnhancedReport(
        runId, mochawesomeReport, environment, steps, screenshots, stdoutBuffer
      );

      // Lưu enhanced report
      const enhancedReportPath = path.join(REPORTS_DIR, `enhanced_${runId}.json`);
      fs.writeFileSync(enhancedReportPath, JSON.stringify(enhancedReport, null, 2), 'utf-8');

      // Broadcast: test hoàn tất
      broadcast(wsBroadcast, {
        type: 'test_complete',
        runId,
        report: enhancedReport
      });

      resolve({
        success: code === 0,
        stdout: cleanStdout(stdoutBuffer),
        stderr: stderrBuffer,
        reportFolder: REPORTS_DIR,
        reportHtml: path.join(REPORTS_DIR, `${reportFilename}.html`),
        enhancedReport
      });
    });
  });
}

/**
 * Xử lý events realtime và broadcast qua WebSocket
 */
function handleRealtimeEvent(parsed, wsBroadcast, runId, state) {
  const eventType = parsed.event;

  switch (eventType) {
    case 'test_suite_start':
      broadcast(wsBroadcast, {
        type: 'test_progress',
        event: 'suite_start',
        runId,
        title: parsed.title
      });
      break;
    case 'env_collected':
      broadcast(wsBroadcast, {
        type: 'test_progress',
        event: 'env_collected',
        runId,
        environment: parsed
      });
      break;
    case 'test_case_start':
      broadcast(wsBroadcast, {
        type: 'test_progress',
        event: 'test_case_start',
        runId,
        title: parsed.title
      });
      break;
    case 'test_case_pass':
      broadcast(wsBroadcast, {
        type: 'test_progress',
        event: 'test_case_pass',
        runId,
        title: parsed.title,
        duration: parsed.duration
      });
      break;
    case 'test_case_fail':
      broadcast(wsBroadcast, {
        type: 'test_progress',
        event: 'test_case_fail',
        runId,
        title: parsed.title,
        duration: parsed.duration,
        error: parsed.error
      });
      break;
    case 'step':
      broadcast(wsBroadcast, {
        type: 'test_progress',
        event: 'step',
        runId,
        step: parsed
      });
      break;
    case 'screenshot_captured':
      broadcast(wsBroadcast, {
        type: 'test_progress',
        event: 'screenshot',
        runId,
        filename: parsed.filename,
        testTitle: parsed.testTitle
      });
      break;
    case 'test_suite_end':
      broadcast(wsBroadcast, {
        type: 'test_progress',
        event: 'suite_end',
        runId,
        environment: parsed.environment
      });
      break;
    default:
      break;
  }
}

/**
 * Xây dựng báo cáo tổng hợp từ mochawesome + dữ liệu inject
 */
function buildEnhancedReport(runId, mochawesomeReport, environment, steps, screenshots, stdout) {
  const report = {
    runId,
    timestamp: new Date().toISOString(),
    environment: {
      browser: environment.browser || 'Unknown',
      os: environment.os || os.type() + ' ' + os.release(),
      platform: environment.platform || os.platform(),
      nodeVersion: environment.nodeVersion || process.version,
      startTime: environment.startTime || null,
      endTime: environment.endTime || new Date().toISOString(),
      duration: environment.duration || 0
    },
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      pending: 0,
      passRate: 0
    },
    testCases: [],
    screenshots,
    steps
  };

  if (mochawesomeReport && mochawesomeReport.stats) {
    const stats = mochawesomeReport.stats;
    report.summary = {
      total: stats.tests || 0,
      passed: stats.passes || 0,
      failed: stats.failures || 0,
      pending: stats.pending || 0,
      passRate: stats.tests > 0
        ? Math.round((stats.passes / stats.tests) * 100 * 10) / 10
        : 0
    };
    report.environment.duration = stats.duration || 0;
  }

  // Extract test cases từ mochawesome
  if (mochawesomeReport && mochawesomeReport.results) {
    for (const result of mochawesomeReport.results) {
      extractTestCases(result, report.testCases, screenshots);
    }
  }

  return report;
}

/**
 * Đệ quy trích xuất test cases từ cấu trúc mochawesome
 */
function extractTestCases(node, testCases, screenshots) {
  if (node.suites) {
    for (const suite of node.suites) {
      if (suite.tests) {
        for (const test of suite.tests) {
          const tc = {
            id: test.uuid,
            title: test.title,
            fullTitle: test.fullTitle,
            status: test.pass ? 'passed' : test.fail ? 'failed' : 'pending',
            duration: test.duration || 0,
            error: test.err && test.err.message ? {
              message: test.err.message,
              stack: test.err.estack || ''
            } : null,
            screenshot: null,
            code: test.code || ''
          };

          // Tìm screenshot tương ứng cho test fail
          if (tc.status === 'failed' && screenshots.length > 0) {
            tc.screenshot = screenshots.shift() || null;
          }

          testCases.push(tc);
        }
      }
      // Đệ quy sub-suites
      extractTestCases(suite, testCases, screenshots);
    }
  }
}

/**
 * Lọc stdout: bỏ JSON-line events, giữ lại output bình thường
 */
function cleanStdout(raw) {
  return raw.split('\n')
    .filter(line => {
      const t = line.trim();
      if (!t) return false;
      try {
        const p = JSON.parse(t);
        return !p.__qaStudioEvent;
      } catch (e) {
        return true;
      }
    })
    .join('\n');
}

/**
 * Liệt kê tất cả enhanced reports
 */
function listReports() {
  ensureDirs();
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith('enhanced_') && f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a)); // mới nhất trước

  return files.map(f => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf-8'));
      return {
        runId: content.runId,
        timestamp: content.timestamp,
        summary: content.summary,
        environment: {
          browser: content.environment?.browser,
          os: content.environment?.os,
          duration: content.environment?.duration
        }
      };
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Lấy 1 report chi tiết
 */
function getReport(runId) {
  const filePath = path.join(REPORTS_DIR, `enhanced_${runId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function broadcast(fn, data) {
  if (fn) fn(data);
}

module.exports = {
  runEnhancedTest,
  listReports,
  getReport,
  REPORTS_DIR,
  SCREENSHOTS_DIR
};
