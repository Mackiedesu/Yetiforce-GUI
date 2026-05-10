const testCaseRepository = require('../../infrastructure/testCase.repository.pg');
const { ensureUuid, validateTestCasePayload } = require('./testCase.validator');

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

  const payload = validateTestCasePayload(req.body);
  const testCase = await testCaseRepository.createTestCase(projectId, payload);
  return res.json({ success: true, test_case: testCase });
}

async function updateProjectTestCaseHandler(req, res) {
  const { projectId, testCaseId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(testCaseId, 'testCaseId');

  const payload = validateTestCasePayload(req.body);
  const testCase = await testCaseRepository.updateTestCase(projectId, testCaseId, payload);
  if (!testCase) {
    return res.status(404).json({ error: 'Test case không tồn tại trong project này' });
  }

  return res.json({ success: true, test_case: testCase });
}

async function deleteProjectTestCaseHandler(req, res) {
  const { projectId, testCaseId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(testCaseId, 'testCaseId');

  const isDeleted = await testCaseRepository.deleteTestCase(projectId, testCaseId);
  if (!isDeleted) {
    return res.status(404).json({ error: 'Test case không tồn tại trong project này' });
  }

  return res.json({ success: true });
}

module.exports = {
  listProjectTestCasesHandler,
  getProjectTestCaseHandler,
  createProjectTestCaseHandler,
  updateProjectTestCaseHandler,
  deleteProjectTestCaseHandler
};
