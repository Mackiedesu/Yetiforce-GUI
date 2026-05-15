const testCaseRepository = require('../../infrastructure/testCase.repository.pg');
const { ensureUuid, validateTestCasePayload } = require('./testCase.validator');
const {
  writeTestCaseFile,
  deleteTestCaseFile,
} = require('../../../projects/infrastructure/mochaFileWriter.service');

async function assertProject(projectId) {
  const exists = await testCaseRepository.projectExists(projectId);
  if (!exists) {
    const error = new Error('Project không tồn tại');
    error.statusCode = 404;
    throw error;
  }
}

async function listProjectTestCasesHandler(req, res) {
  const { projectId } = req.params;
  ensureUuid(projectId, 'projectId');
  await assertProject(projectId);

  const testCases = await testCaseRepository.listTestCasesByProject(projectId);
  return res.json({ success: true, test_cases: testCases });
}

async function getProjectTestCaseHandler(req, res) {
  const { projectId, testCaseId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(testCaseId, 'testCaseId');

  const testCase = await testCaseRepository.getTestCaseById(projectId, testCaseId);
  if (!testCase) {
    return res.status(404).json({ error: 'Test case không tồn tại trong project này' });
  }

  return res.json({ success: true, test_case: testCase });
}

async function createProjectTestCaseHandler(req, res) {
  const { projectId } = req.params;
  ensureUuid(projectId, 'projectId');
  await assertProject(projectId);

  const payload  = validateTestCasePayload(req.body);
  const testCase = await testCaseRepository.createTestCase(projectId, payload);

  // Sync to disk (non-fatal — DB record is source of truth)
  const projectPath = await testCaseRepository.getProjectPath(projectId);
  if (projectPath) {
    const { diskError } = writeTestCaseFile(projectPath, testCase.name, {
      description: testCase.description,
      url:         testCase.url,
      script:      testCase.script,
    });
    if (diskError) {
      // Compensate: remove the just-created DB record so state is consistent
      await testCaseRepository.deleteTestCase(projectId, testCase.id);
      const err = new Error(`Lỗi ghi file Katalon: ${diskError}`);
      err.statusCode = 500;
      throw err;
    }
  }

  return res.json({ success: true, test_case: testCase });
}

async function updateProjectTestCaseHandler(req, res) {
  const { projectId, testCaseId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(testCaseId, 'testCaseId');

  const payload  = validateTestCasePayload(req.body);
  const testCase = await testCaseRepository.updateTestCase(projectId, testCaseId, payload);
  if (!testCase) {
    return res.status(404).json({ error: 'Test case không tồn tại trong project này' });
  }

  // Best-effort disk update (warn in response but don't fail)
  const projectPath = await testCaseRepository.getProjectPath(projectId);
  let diskWarning = null;
  if (projectPath) {
    const { diskError } = writeTestCaseFile(projectPath, testCase.name, {
      description: testCase.description,
      url:         testCase.url,
      script:      testCase.script,
    });
    if (diskError) {
      diskWarning = `File Katalon chưa được cập nhật: ${diskError}`;
      console.warn(`[TestCaseController] Disk update warning: ${diskError}`);
    }
  }

  return res.json({ success: true, test_case: testCase, ...(diskWarning && { disk_warning: diskWarning }) });
}

async function deleteProjectTestCaseHandler(req, res) {
  const { projectId, testCaseId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(testCaseId, 'testCaseId');

  // Get name for disk cleanup before deleting from DB
  const testCase = await testCaseRepository.getTestCaseById(projectId, testCaseId);
  if (!testCase) {
    return res.status(404).json({ error: 'Test case không tồn tại trong project này' });
  }

  const isDeleted = await testCaseRepository.deleteTestCase(projectId, testCaseId);
  if (!isDeleted) {
    return res.status(404).json({ error: 'Test case không tồn tại trong project này' });
  }

  // Best-effort disk cleanup
  const projectPath = await testCaseRepository.getProjectPath(projectId);
  if (projectPath) deleteTestCaseFile(projectPath, testCase.name);

  return res.json({ success: true });
}

module.exports = {
  listProjectTestCasesHandler,
  getProjectTestCaseHandler,
  createProjectTestCaseHandler,
  updateProjectTestCaseHandler,
  deleteProjectTestCaseHandler
};
