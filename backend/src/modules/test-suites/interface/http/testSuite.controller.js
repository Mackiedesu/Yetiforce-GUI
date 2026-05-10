const suiteRepository = require('../../infrastructure/testSuite.repository.pg');
const {
  ensureUuid,
  validateSuitePayload,
  validateTestCasePayload,
  validateReorderPayload
} = require('./testSuite.validator');

async function assertProject(projectId) {
  const exists = await suiteRepository.projectExists(projectId);
  if (!exists) {
    const error = new Error('Project không tồn tại');
    error.statusCode = 404;
    throw error;
  }
}

async function listProjectSuitesHandler(req, res) {
  const { projectId } = req.params;
  ensureUuid(projectId, 'projectId');
  await assertProject(projectId);

  const suites = await suiteRepository.listSuitesByProject(projectId);
  return res.json({ success: true, suites });
}

async function getProjectSuiteHandler(req, res) {
  const { projectId, suiteId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(suiteId, 'suiteId');

  const suite = await suiteRepository.getSuiteById(projectId, suiteId);
  if (!suite) {
    return res.status(404).json({ error: 'Suite không tồn tại trong project này' });
  }

  return res.json({ success: true, suite });
}

async function createProjectSuiteHandler(req, res) {
  const { projectId } = req.params;
  ensureUuid(projectId, 'projectId');
  await assertProject(projectId);

  const suitePayload = validateSuitePayload(req.body);
  const testCases = Array.isArray(req.body.test_cases)
    ? req.body.test_cases.map(validateTestCasePayload)
    : [];

  const suite = await suiteRepository.createSuite(projectId, {
    ...suitePayload,
    test_cases: testCases
  });

  return res.json({ success: true, suite });
}

async function updateProjectSuiteHandler(req, res) {
  const { projectId, suiteId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(suiteId, 'suiteId');

  const suitePayload = validateSuitePayload(req.body);
  const suite = await suiteRepository.updateSuite(projectId, suiteId, suitePayload);
  if (!suite) {
    return res.status(404).json({ error: 'Suite không tồn tại trong project này' });
  }

  return res.json({ success: true, suite });
}

async function deleteProjectSuiteHandler(req, res) {
  const { projectId, suiteId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(suiteId, 'suiteId');

  const isDeleted = await suiteRepository.deleteSuite(projectId, suiteId);
  if (!isDeleted) {
    return res.status(404).json({ error: 'Suite không tồn tại trong project này' });
  }

  return res.json({ success: true });
}

async function addSuiteTestCaseHandler(req, res) {
  const { projectId, suiteId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(suiteId, 'suiteId');

  const payload = validateTestCasePayload(req.body);
  const suite = await suiteRepository.addTestCase(projectId, suiteId, payload);
  if (!suite) {
    return res.status(404).json({ error: 'Suite không tồn tại trong project này' });
  }

  return res.json({ success: true, suite });
}

async function updateSuiteTestCaseHandler(req, res) {
  const { projectId, suiteId, testCaseId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(suiteId, 'suiteId');
  ensureUuid(testCaseId, 'testCaseId');

  const payload = validateTestCasePayload(req.body);
  const suite = await suiteRepository.updateTestCase(projectId, suiteId, testCaseId, payload);
  if (suite === null) {
    return res.status(404).json({ error: 'Suite không tồn tại trong project này' });
  }
  if (suite === false) {
    return res.status(404).json({ error: 'Test case không tồn tại trong suite này' });
  }

  return res.json({ success: true, suite });
}

async function deleteSuiteTestCaseHandler(req, res) {
  const { projectId, suiteId, testCaseId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(suiteId, 'suiteId');
  ensureUuid(testCaseId, 'testCaseId');

  const result = await suiteRepository.deleteTestCase(projectId, suiteId, testCaseId);
  if (result === null) {
    return res.status(404).json({ error: 'Suite không tồn tại trong project này' });
  }
  if (result === false) {
    return res.status(404).json({ error: 'Test case không tồn tại trong suite này' });
  }

  const suite = await suiteRepository.getSuiteById(projectId, suiteId);
  return res.json({ success: true, suite });
}

async function reorderSuiteTestCasesHandler(req, res) {
  const { projectId, suiteId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(suiteId, 'suiteId');

  const reorderItems = validateReorderPayload(req.body);
  const suite = await suiteRepository.reorderTestCases(projectId, suiteId, reorderItems);
  if (!suite) {
    return res.status(404).json({ error: 'Suite không tồn tại trong project này' });
  }

  return res.json({ success: true, suite });
}

module.exports = {
  listProjectSuitesHandler,
  getProjectSuiteHandler,
  createProjectSuiteHandler,
  updateProjectSuiteHandler,
  deleteProjectSuiteHandler,
  addSuiteTestCaseHandler,
  updateSuiteTestCaseHandler,
  deleteSuiteTestCaseHandler,
  reorderSuiteTestCasesHandler
};
