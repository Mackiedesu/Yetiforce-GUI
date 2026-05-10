const executionRepository = require('../../infrastructure/execution.repository.pg');
const { executeKatalon } = require('../../../../services/katalon/katalonExecutor.service');
const { validateStartPayload, ensureUuid } = require('./execution.validator');
const { sanitizePath, sanitizeProfile } = require('../../../../utils/pathSanitizer');

let _broadcast = () => {};

function setExecutionBroadcast(fn) {
  _broadcast = fn;
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

  // Sanitize paths: strip surrounding quotes the user may have typed,
  // trim whitespace, and collapse accidental double-spaces.
  const cleanProjectPath = sanitizePath(project_path, 'project_path');
  const cleanSuitePath   = sanitizePath(suite_path,   'suite_path');
  const cleanProfile     = sanitizeProfile(profile);

  const run = await executionRepository.createRun({
    project_id,
    katalon_executable_path,
    project_path: cleanProjectPath,
    suite_path:   cleanSuitePath,
    browser,
    os: operatingSystem,
    profile: cleanProfile,
    api_key,
  });

  _broadcast({ type: 'katalon_start', runId: run.id, config: { browser, profile: cleanProfile, suite_path: cleanSuitePath } });

  // Fire-and-forget: pass sanitized config so the executor never sees raw user input
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

  async function onLog(level, message) {
    await executionRepository.addLog(runId, level, message);
  }

  try {
    const result = await executeKatalon(config, {
      runId,
      broadcast: _broadcast,
    });

    // Persist each log line
    for (const line of result.lines) {
      await executionRepository.addLog(runId, result.exitCode === 0 ? 'info' : 'warn', line);
    }

    const finalStatus = result.error
      ? 'error'
      : result.exitCode === 0 ? 'passed' : 'failed';

    await executionRepository.updateRun(runId, {
      status: finalStatus,
      exit_code: result.exitCode,
      duration_ms: result.duration,
      total_tests: result.total,
      passed_tests: result.passed,
      failed_tests: result.failed,
      error_message: result.error || null,
    });

    _broadcast({
      type: 'katalon_complete',
      runId,
      status: finalStatus,
      passed: result.passed,
      failed: result.failed,
      total: result.total,
      duration: result.duration,
    });
  } catch (err) {
    await executionRepository.updateRun(runId, {
      status: 'error',
      error_message: err.message,
    });
    _broadcast({ type: 'katalon_complete', runId, status: 'error' });
  }
}

async function listExecutionsHandler(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
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
  if (!run) {
    return res.status(404).json({ error: 'Execution không tồn tại' });
  }
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
