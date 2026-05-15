const executionRepository = require('../../infrastructure/execution.repository.pg');
const { executeKatalon } = require('../../../../services/mocha/mochaExecutor.service');
const { validateStartPayload, ensureUuid } = require('./execution.validator');
const { sanitizePath, sanitizeProfile } = require('../../../../utils/pathSanitizer');

let _broadcast = () => {};

function setExecutionBroadcast(fn) {
  _broadcast = fn;
}

// Extract a human-readable suite name from the path
// e.g. "Test Suites/Module/LoginSuite" → "LoginSuite"
function extractSuiteName(suitePath) {
  if (!suitePath) return null;
  const parts = suitePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || suitePath;
}

async function startExecutionHandler(req, res) {
  validateStartPayload(req.body);

  const {
    project_id,
    katalon_executable_path,
    project_path,
    suite_path,
    browser = 'Chrome',
    os: operatingSystem,
    profile = 'default',
    api_key,
  } = req.body;

  const cleanProjectPath = sanitizePath(project_path, 'project_path');
  const cleanSuitePath   = sanitizePath(suite_path,   'suite_path');
  const cleanProfile     = sanitizeProfile(profile);
  const suiteName        = extractSuiteName(cleanSuitePath);

  const run = await executionRepository.createRun({
    project_id,
    katalon_executable_path,
    project_path: cleanProjectPath,
    suite_path:   cleanSuitePath,
    suite_name:   suiteName,
    browser,
    os: operatingSystem,
    profile: cleanProfile,
    api_key,
  });

  _broadcast({
    type: 'katalon_start',
    runId: run.id,
    config: { browser, profile: cleanProfile, suite_path: cleanSuitePath, suite_name: suiteName },
  });

  const cleanConfig = {
    ...req.body,
    project_path: cleanProjectPath,
    suite_path:   cleanSuitePath,
    profile:      cleanProfile,
  };
  runExecution(run, cleanConfig).catch(() => {});

  return res.status(201).json({ success: true, run });
}

async function runExecution(run, config) {
  const runId = run.id;

  try {
    const result = await executeKatalon(config, { runId, broadcast: _broadcast });

    // Save every stdout/stderr line to the DB
    for (const line of result.lines) {
      await executionRepository.addLog(
        runId,
        result.exitCode === 0 ? 'info' : 'warn',
        line
      );
    }

    const finalStatus = result.error
      ? 'error'
      : result.exitCode === 0 ? 'passed' : 'failed';

    // Persist test case details from report parsing
    if (result.testCaseDetails && result.testCaseDetails.length > 0) {
      try {
        await executionRepository.addRunDetails(runId, result.testCaseDetails);
      } catch (detailErr) {
        console.warn(`[Execution] Failed to save test case details: ${detailErr.message}`);
      }
    }

    await executionRepository.updateRun(runId, {
      status:           finalStatus,
      exit_code:        result.exitCode,
      duration_ms:      result.duration,
      total_tests:      result.total,
      passed_tests:     result.passed,
      failed_tests:     result.failed,
      skipped_tests:    result.skipped || 0,
      error_tests:      result.errors  || 0,
      error_message:    result.error   || null,
      ended_at:         new Date(),
      report_path:      result.reportPath  || null,
      parse_warning:    result.parseError  || null,
    });

    _broadcast({
      type: 'katalon_complete',
      runId,
      status:   finalStatus,
      passed:   result.passed,
      failed:   result.failed,
      total:    result.total,
      duration: result.duration,
    });
  } catch (err) {
    await executionRepository.updateRun(runId, {
      status:        'error',
      error_message: err.message,
      ended_at:      new Date(),
    });
    _broadcast({ type: 'katalon_complete', runId, status: 'error' });
  }
}

async function listExecutionsHandler(req, res) {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const status = req.query.status || undefined;
  const result = await executionRepository.listRuns({ page, limit, status });
  return res.json({ success: true, ...result });
}

async function getStatsHandler(req, res) {
  const stats = await executionRepository.getStats();
  return res.json({ success: true, stats });
}

async function getExecutionHandler(req, res) {
  ensureUuid(req.params.id, 'id');
  const run = await executionRepository.getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Execution không tồn tại' });
  return res.json({ success: true, run });
}

async function deleteExecutionHandler(req, res) {
  ensureUuid(req.params.id, 'id');
  await executionRepository.deleteRun(req.params.id);
  return res.json({ success: true });
}

module.exports = {
  setExecutionBroadcast,
  startExecutionHandler,
  listExecutionsHandler,
  getStatsHandler,
  getExecutionHandler,
  deleteExecutionHandler,
};
