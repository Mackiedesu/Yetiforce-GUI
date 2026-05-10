const fs = require('fs');
const path = require('path');

const { TEST_SUITES_DIR } = require('../config/paths');
const { ensureDir } = require('../utils/fs');

function ensureSuitesDir() {
  ensureDir(TEST_SUITES_DIR);
}

function getSuiteFilePath(suiteId) {
  return path.join(TEST_SUITES_DIR, `${suiteId}.json`);
}

function createSuite(suiteData) {
  ensureSuitesDir();

  if (!suiteData.name) {
    throw new Error('Tên suite là bắt buộc');
  }

  const suiteId = `suite_${Date.now()}`;
  const suite = {
    suiteId,
    name: suiteData.name,
    description: suiteData.description || '',
    testCases: (suiteData.testCases || []).map((testCase, index) => ({
      id: `tc_${index + 1}`,
      name: testCase.name || `Test Case ${index + 1}`,
      description: testCase.description || '',
      script: testCase.script || '',
      url: testCase.url || ''
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunId: null,
    lastRunResult: null
  };

  fs.writeFileSync(getSuiteFilePath(suiteId), JSON.stringify(suite, null, 2), 'utf-8');
  return suite;
}

function listSuites() {
  ensureSuitesDir();

  const files = fs.readdirSync(TEST_SUITES_DIR).filter((fileName) => fileName.endsWith('.json'));

  return files
    .map((fileName) => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(TEST_SUITES_DIR, fileName), 'utf-8'));
        return {
          suiteId: content.suiteId,
          name: content.name,
          description: content.description,
          testCaseCount: content.testCases ? content.testCases.length : 0,
          createdAt: content.createdAt,
          lastRunResult: content.lastRunResult
        };
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

function getSuite(suiteId) {
  const filePath = getSuiteFilePath(suiteId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function updateSuite(suiteId, updateData) {
  const suite = getSuite(suiteId);
  if (!suite) {
    return null;
  }

  const updated = {
    ...suite,
    ...updateData,
    suiteId: suite.suiteId,
    createdAt: suite.createdAt,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(getSuiteFilePath(suiteId), JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

function deleteSuite(suiteId) {
  const filePath = getSuiteFilePath(suiteId);
  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}

function saveSuiteRunResult(suiteId, runResult) {
  const suite = getSuite(suiteId);
  if (!suite) {
    return null;
  }

  suite.lastRunId = runResult.runId || null;
  suite.lastRunResult = {
    runId: runResult.runId,
    timestamp: new Date().toISOString(),
    summary: runResult.summary || {},
    passRate: runResult.summary?.passRate || 0
  };

  fs.writeFileSync(getSuiteFilePath(suiteId), JSON.stringify(suite, null, 2), 'utf-8');
  return suite;
}

module.exports = {
  createSuite,
  listSuites,
  getSuite,
  updateSuite,
  deleteSuite,
  saveSuiteRunResult,
  TEST_SUITES_DIR
};
