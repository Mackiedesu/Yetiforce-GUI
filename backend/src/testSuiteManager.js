const fs = require('fs');
const path = require('path');

const SUITES_DIR = path.join(__dirname, '..', 'test_suites');

function ensureDir() {
  if (!fs.existsSync(SUITES_DIR)) fs.mkdirSync(SUITES_DIR, { recursive: true });
}

/**
 * Tạo Test Suite mới
 * @param {Object} suiteData - { name, description, testCases: [{ name, description, script }] }
 */
function createSuite(suiteData) {
  ensureDir();

  if (!suiteData.name) throw new Error('Tên suite là bắt buộc');

  const suiteId = 'suite_' + Date.now();
  const suite = {
    suiteId,
    name: suiteData.name,
    description: suiteData.description || '',
    testCases: (suiteData.testCases || []).map((tc, idx) => ({
      id: `tc_${idx + 1}`,
      name: tc.name || `Test Case ${idx + 1}`,
      description: tc.description || '',
      script: tc.script || '',
      url: tc.url || ''
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunId: null,
    lastRunResult: null
  };

  const filePath = path.join(SUITES_DIR, `${suiteId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(suite, null, 2), 'utf-8');
  return suite;
}

/**
 * Liệt kê tất cả suites
 */
function listSuites() {
  ensureDir();
  const files = fs.readdirSync(SUITES_DIR).filter(f => f.endsWith('.json'));

  return files.map(f => {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(SUITES_DIR, f), 'utf-8'));
      return {
        suiteId: content.suiteId,
        name: content.name,
        description: content.description,
        testCaseCount: content.testCases ? content.testCases.length : 0,
        createdAt: content.createdAt,
        lastRunResult: content.lastRunResult
      };
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Lấy 1 suite chi tiết
 */
function getSuite(suiteId) {
  const filePath = path.join(SUITES_DIR, `${suiteId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Cập nhật suite
 */
function updateSuite(suiteId, updateData) {
  const suite = getSuite(suiteId);
  if (!suite) return null;

  const updated = {
    ...suite,
    ...updateData,
    suiteId: suite.suiteId,
    createdAt: suite.createdAt,
    updatedAt: new Date().toISOString()
  };

  const filePath = path.join(SUITES_DIR, `${suiteId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

/**
 * Xóa suite
 */
function deleteSuite(suiteId) {
  const filePath = path.join(SUITES_DIR, `${suiteId}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

/**
 * Lưu kết quả chạy suite
 */
function saveSuiteRunResult(suiteId, runResult) {
  const suite = getSuite(suiteId);
  if (!suite) return null;

  suite.lastRunId = runResult.runId || null;
  suite.lastRunResult = {
    runId: runResult.runId,
    timestamp: new Date().toISOString(),
    summary: runResult.summary || {},
    passRate: runResult.summary?.passRate || 0
  };

  const filePath = path.join(SUITES_DIR, `${suiteId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(suite, null, 2), 'utf-8');
  return suite;
}

module.exports = {
  createSuite,
  listSuites,
  getSuite,
  updateSuite,
  deleteSuite,
  saveSuiteRunResult,
  SUITES_DIR
};
