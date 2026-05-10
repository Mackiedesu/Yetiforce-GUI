const { randomUUID } = require('crypto');
const { query, pool } = require('../../../config/database');

async function ensureTablesExist() {
  await query(`
    CREATE TABLE IF NOT EXISTS katalon_execution_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
      katalon_executable_path TEXT,
      project_path TEXT NOT NULL,
      suite_path TEXT NOT NULL,
      browser VARCHAR(50) NOT NULL DEFAULT 'Chrome',
      os VARCHAR(100),
      profile VARCHAR(100) NOT NULL DEFAULT 'default',
      api_key TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      exit_code INTEGER,
      duration_ms BIGINT,
      total_tests INTEGER NOT NULL DEFAULT 0,
      passed_tests INTEGER NOT NULL DEFAULT 0,
      failed_tests INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS katalon_execution_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID NOT NULL REFERENCES katalon_execution_runs(id) ON DELETE CASCADE,
      level VARCHAR(20) NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_kel_run_id ON katalon_execution_logs(run_id)
  `);
}

async function createRun(data) {
  const id = randomUUID();
  const result = await query(
    `INSERT INTO katalon_execution_runs
       (id, project_id, katalon_executable_path, project_path, suite_path,
        browser, os, profile, api_key, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'running')
     RETURNING *`,
    [
      id,
      data.project_id || null,
      data.katalon_executable_path || null,
      data.project_path,
      data.suite_path,
      data.browser || 'Chrome',
      data.os || null,
      data.profile || 'default',
      data.api_key || null,
    ]
  );
  return result.rows[0];
}

async function updateRun(id, fields) {
  const sets = [];
  const values = [];
  let idx = 1;

  for (const [key, val] of Object.entries(fields)) {
    sets.push(`${key} = $${idx++}`);
    values.push(val);
  }
  sets.push(`updated_at = NOW()`);
  values.push(id);

  await query(
    `UPDATE katalon_execution_runs SET ${sets.join(', ')} WHERE id = $${idx}`,
    values
  );
}

async function addLog(runId, level, message) {
  await query(
    `INSERT INTO katalon_execution_logs (id, run_id, level, message)
     VALUES ($1,$2,$3,$4)`,
    [randomUUID(), runId, level, message]
  );
}

async function listRuns({ page = 1, limit = 10, status } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];
  let idx = 1;

  if (status) {
    conditions.push(`r.status = $${idx++}`);
    values.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT r.id, r.project_id, p.name AS project_name,
              r.project_path, r.suite_path, r.browser, r.os, r.profile,
              r.status, r.exit_code, r.duration_ms,
              r.total_tests, r.passed_tests, r.failed_tests, r.error_message,
              r.created_at, r.updated_at
       FROM katalon_execution_runs r
       LEFT JOIN projects p ON p.id = r.project_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    ),
    query(
      `SELECT COUNT(*) FROM katalon_execution_runs r ${where}`,
      values
    ),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);
  return { runs: dataResult.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function getStats() {
  const [statusResult, recentResult] = await Promise.all([
    query(
      `SELECT status, COUNT(*) AS count
       FROM katalon_execution_runs
       GROUP BY status`
    ),
    query(
      `SELECT r.id, r.suite_path, r.status, r.passed_tests, r.failed_tests,
              r.total_tests, r.duration_ms, r.created_at, p.name AS project_name
       FROM katalon_execution_runs r
       LEFT JOIN projects p ON p.id = r.project_id
       ORDER BY r.created_at DESC
       LIMIT 10`
    ),
  ]);

  const statusCounts = { passed: 0, failed: 0, error: 0, running: 0, pending: 0 };
  let totalRuns = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const row of statusResult.rows) {
    statusCounts[row.status] = parseInt(row.count, 10);
    totalRuns += parseInt(row.count, 10);
  }

  const avgResult = await query(
    `SELECT AVG(duration_ms) AS avg_ms, SUM(passed_tests) AS total_passed, SUM(failed_tests) AS total_failed
     FROM katalon_execution_runs
     WHERE status IN ('passed', 'failed')`
  );

  totalPassed = parseInt(avgResult.rows[0].total_passed || 0, 10);
  totalFailed = parseInt(avgResult.rows[0].total_failed || 0, 10);
  const avgDurationMs = parseFloat(avgResult.rows[0].avg_ms || 0);

  return {
    totalRuns,
    statusCounts,
    totalPassed,
    totalFailed,
    avgDurationMs,
    recentRuns: recentResult.rows,
  };
}

async function getRun(id) {
  const runResult = await query(
    `SELECT * FROM katalon_execution_runs WHERE id = $1`,
    [id]
  );
  if (runResult.rowCount === 0) return null;

  const logsResult = await query(
    `SELECT id, level, message, logged_at
     FROM katalon_execution_logs
     WHERE run_id = $1
     ORDER BY logged_at ASC`,
    [id]
  );

  return { ...runResult.rows[0], logs: logsResult.rows };
}

async function deleteRun(id) {
  await query(`DELETE FROM katalon_execution_runs WHERE id = $1`, [id]);
}

module.exports = {
  ensureTablesExist,
  createRun,
  updateRun,
  addLog,
  listRuns,
  getStats,
  getRun,
  deleteRun,
};
