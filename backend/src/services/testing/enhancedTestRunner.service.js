const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const { BACKEND_ROOT, REPORTS_DIR, SCREENSHOTS_DIR, TMP_TESTS_DIR } = require('../../config/paths');
const { ensureDir } = require('../../utils/fs');

function ensureDirs() {
  ensureDir(REPORTS_DIR);
  ensureDir(SCREENSHOTS_DIR);
  ensureDir(TMP_TESTS_DIR);
}

function wrapScript(originalScript, runId) {
  const screenshotDir = SCREENSHOTS_DIR.replace(/\\/g, '\\\\');
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

function __logEvent(event, data) {
  const msg = JSON.stringify({ __qaStudioEvent: true, event, ...data, timestamp: new Date().toISOString() });
  process.stdout.write(msg + '\\n');
}

function __logStep(action, status, duration, error) {
  const step = { action, status, duration: duration || 0, timestamp: new Date().toISOString() };
  if (error) step.error = error;
  __stepLogs.push(step);
  __logEvent('step', step);
}

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

let __activeDriver = null;
`;

  let modifiedScript = originalScript;

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
        if (__activeDriver) {
          try {
            const screenshot = await __activeDriver.takeScreenshot();
            const filename = __runId + '_fail_' + Date.now() + '.png';
            __fs.writeFileSync(__path.join(__screenshotDir, filename), screenshot, 'base64');
            __logEvent('screenshot_captured', { filename, testTitle: test.title });
          } catch(e) {}
        }
      }
    }
  });

  `;
    modifiedScript = modifiedScript.replace(afterMatch[0], testHooks + afterMatch[0]);
  }

  const afterBody = /after\s*\(\s*async\s+function\s*\(\)\s*\{/;
  const afterBodyMatch = modifiedScript.match(afterBody);
  if (afterBodyMatch) {
    const summaryCode = `
    __envInfo.endTime = new Date().toISOString();
    __envInfo.duration = Date.now() - __testStartTime;
    __logEvent('test_suite_end', { environment: __envInfo, steps: __stepLogs });
`;
    modifiedScript = modifiedScript.replace(afterBodyMatch[0], afterBodyMatch[0] + summaryCode);
  }

  return wrapperHeader + '\n' + modifiedScript;
}

async function runEnhancedTest(scriptContent, wsBroadcast) {
  ensureDirs();

  const runId = `run_${Date.now()}`;
  const wrappedScript = wrapScript(scriptContent, runId);
  const filename = `test_${runId}.test.js`;
  const filePath = path.join(TMP_TESTS_DIR, filename);
  fs.writeFileSync(filePath, wrappedScript);

  const reportFilename = `report_${runId}`;

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
      cwd: BACKEND_ROOT,
      shell: true,
      env: { ...process.env }
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    const environment = {};
    const steps = [];
    const screenshots = [];

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdoutBuffer += text;

      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.__qaStudioEvent) {
            handleRealtimeEvent(parsed, wsBroadcast, runId);

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
        } catch (error) {
          // Non-JSON Mocha output
        }
      }
    });

    child.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    child.on('close', (code) => {
      let mochawesomeReport = null;
      const jsonReportPath = path.join(REPORTS_DIR, `${reportFilename}.json`);

      try {
        if (fs.existsSync(jsonReportPath)) {
          mochawesomeReport = JSON.parse(fs.readFileSync(jsonReportPath, 'utf-8'));
        }
      } catch (error) {
        console.error('Lỗi đọc mochawesome report:', error.message);
      }

      const enhancedReport = buildEnhancedReport(runId, mochawesomeReport, environment, steps, screenshots);
      const enhancedReportPath = path.join(REPORTS_DIR, `enhanced_${runId}.json`);
      fs.writeFileSync(enhancedReportPath, JSON.stringify(enhancedReport, null, 2), 'utf-8');

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

function handleRealtimeEvent(parsed, wsBroadcast, runId) {
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

function buildEnhancedReport(runId, mochawesomeReport, environment, steps, screenshots) {
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
      passRate: stats.tests > 0 ? Math.round((stats.passes / stats.tests) * 100 * 10) / 10 : 0
    };
    report.environment.duration = stats.duration || 0;
  }

  if (mochawesomeReport && mochawesomeReport.results) {
    for (const result of mochawesomeReport.results) {
      extractTestCases(result, report.testCases, screenshots);
    }
  }

  return report;
}

function extractTestCases(node, testCases, screenshots) {
  if (!node.suites) {
    return;
  }

  for (const suite of node.suites) {
    if (suite.tests) {
      for (const test of suite.tests) {
        const testCase = {
          id: test.uuid,
          title: test.title,
          fullTitle: test.fullTitle,
          status: test.pass ? 'passed' : test.fail ? 'failed' : 'pending',
          duration: test.duration || 0,
          error: test.err && test.err.message
            ? { message: test.err.message, stack: test.err.estack || '' }
            : null,
          screenshot: null,
          code: test.code || ''
        };

        if (testCase.status === 'failed' && screenshots.length > 0) {
          testCase.screenshot = screenshots.shift() || null;
        }

        testCases.push(testCase);
      }
    }

    extractTestCases(suite, testCases, screenshots);
  }
}

function cleanStdout(raw) {
  return raw
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return false;
      }

      try {
        const parsed = JSON.parse(trimmed);
        return !parsed.__qaStudioEvent;
      } catch (error) {
        return true;
      }
    })
    .join('\n');
}

function listReports() {
  ensureDirs();
  const files = fs
    .readdirSync(REPORTS_DIR)
    .filter((fileName) => fileName.startsWith('enhanced_') && fileName.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a));

  return files
    .map((fileName) => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, fileName), 'utf-8'));
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
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function getReport(runId) {
  const filePath = path.join(REPORTS_DIR, `enhanced_${runId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function broadcast(fn, data) {
  if (fn) {
    fn(data);
  }
}

module.exports = {
  runEnhancedTest,
  listReports,
  getReport,
  REPORTS_DIR,
  SCREENSHOTS_DIR
};
