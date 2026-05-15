const suiteRepository = require('../../infrastructure/testSuite.repository.pg');
const {
  ensureUuid,
  validateSuitePayload,
  validateTestCasePayload,
  validateReorderPayload
} = require('./testSuite.validator');
const {
  writeTestCaseFile,
  writeTestSuiteFile,
  deleteTestSuiteFile,
} = require('../../../projects/infrastructure/mochaFileWriter.service');

async function assertProject(projectId) {
  const exists = await suiteRepository.projectExists(projectId);
  if (!exists) {
    const error = new Error('Project không tồn tại');
    error.statusCode = 404;
    throw error;
  }
}

// Regenerate the .ts file for a suite from its current DB state
async function syncSuiteToDisk(projectId, suiteId) {
  try {
    const projectPath = await suiteRepository.getProjectPath(projectId);
    if (!projectPath) return null;

    const suite = await suiteRepository.getSuiteById(projectId, suiteId);
    if (!suite) return null;

    const { diskError } = writeTestSuiteFile(projectPath, suite.name, {
      description: suite.description,
      suiteId:     suite.id,
      testCases:   (suite.test_cases || []).map((tc) => ({ id: tc.id, name: tc.name })),
    });
    return diskError || null;
  } catch (err) {
    return err.message;
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
  const testCases    = Array.isArray(req.body.test_cases)
    ? req.body.test_cases.map(validateTestCasePayload)
    : [];

  const suite = await suiteRepository.createSuite(projectId, { ...suitePayload, test_cases: testCases });

  // Sync to disk (compensate on failure)
  const projectPath = await suiteRepository.getProjectPath(projectId);
  if (projectPath) {
    const { diskError } = writeTestSuiteFile(projectPath, suite.name, {
      description: suite.description,
      suiteId:     suite.id,
      testCases:   (suite.test_cases || []).map((tc) => ({ id: tc.id, name: tc.name })),
    });
    if (diskError) {
      await suiteRepository.deleteSuite(projectId, suite.id);
      const err = new Error(`Lỗi ghi file Katalon: ${diskError}`);
      err.statusCode = 500;
      throw err;
    }
  }

  return res.json({ success: true, suite });
}

async function updateProjectSuiteHandler(req, res) {
  const { projectId, suiteId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(suiteId, 'suiteId');

  const suitePayload = validateSuitePayload(req.body);
  const suite        = await suiteRepository.updateSuite(projectId, suiteId, suitePayload);
  if (!suite) {
    return res.status(404).json({ error: 'Suite không tồn tại trong project này' });
  }

  // Best-effort disk update
  const diskError = await syncSuiteToDisk(projectId, suiteId);
  if (diskError) console.warn(`[SuiteController] Disk update warning: ${diskError}`);

  return res.json({ success: true, suite, ...(diskError && { disk_warning: `File Katalon chưa được cập nhật: ${diskError}` }) });
}

async function deleteProjectSuiteHandler(req, res) {
  const { projectId, suiteId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(suiteId, 'suiteId');

  // Get suite name for disk cleanup before deleting
  const suite = await suiteRepository.getSuiteById(projectId, suiteId);
  if (!suite) {
    return res.status(404).json({ error: 'Suite không tồn tại trong project này' });
  }

  const isDeleted = await suiteRepository.deleteSuite(projectId, suiteId);
  if (!isDeleted) {
    return res.status(404).json({ error: 'Suite không tồn tại trong project này' });
  }

  // Best-effort disk cleanup
  const projectPath = await suiteRepository.getProjectPath(projectId);
  if (projectPath) deleteTestSuiteFile(projectPath, suite.name);

  return res.json({ success: true });
}

async function addSuiteTestCaseHandler(req, res) {
  const { projectId, suiteId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(suiteId, 'suiteId');

  const payload        = validateTestCasePayload(req.body);
  const isInlineCreate = !payload.test_case_id;  // true = new TC, false = linking existing

  const suite   = await suiteRepository.addTestCase(projectId, suiteId, payload);
  if (!suite) {
    return res.status(404).json({ error: 'Suite không tồn tại trong project này' });
  }

  // For inline creation, write .tc + .groovy files so KRE can execute the test case
  if (isInlineCreate && suite.test_cases && suite.test_cases.length > 0) {
    const projectPath = await suiteRepository.getProjectPath(projectId);
    if (projectPath) {
      // Newly added TC is last in the execution-ordered list
      const newTc = suite.test_cases[suite.test_cases.length - 1];
      const { diskError: tcDiskError } = writeTestCaseFile(projectPath, newTc.name, {
        description: newTc.description || '',
        url:         newTc.url         || '',
        script:      newTc.script      || '',
      });
      if (tcDiskError) console.warn(`[SuiteController] Disk write warning for new TC "${newTc.name}": ${tcDiskError}`);
    }
  }

  // Regenerate .ts file with updated test case list (best-effort)
  const diskError = await syncSuiteToDisk(projectId, suiteId);
  if (diskError) console.warn(`[SuiteController] Disk sync warning after addTestCase: ${diskError}`);

  return res.json({ success: true, suite });
}

async function updateSuiteTestCaseHandler(req, res) {
  const { projectId, suiteId, testCaseId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(suiteId, 'suiteId');
  ensureUuid(testCaseId, 'testCaseId');

  const payload = validateTestCasePayload(req.body);
  const suite   = await suiteRepository.updateTestCase(projectId, suiteId, testCaseId, payload);
  if (suite === null) {
    return res.status(404).json({ error: 'Suite không tồn tại trong project này' });
  }
  if (suite === false) {
    return res.status(404).json({ error: 'Test case không tồn tại trong suite này' });
  }

  // Inline edit (not a test-case-id swap) — update .tc/.groovy on disk
  if (!payload.test_case_id) {
    const projectPath = await suiteRepository.getProjectPath(projectId);
    if (projectPath) {
      const { diskError: tcDiskError } = writeTestCaseFile(projectPath, payload.name, {
        description: payload.description || '',
        url:         payload.url         || '',
        script:      payload.script      || '',
      });
      if (tcDiskError) console.warn(`[SuiteController] Disk update warning for TC "${payload.name}": ${tcDiskError}`);
    }
    // Resync .ts in case TC name changed
    const tsDiskError = await syncSuiteToDisk(projectId, suiteId);
    if (tsDiskError) console.warn(`[SuiteController] Disk sync warning after updateTestCase: ${tsDiskError}`);
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

  // Regenerate .ts file (best-effort)
  const diskError = await syncSuiteToDisk(projectId, suiteId);
  if (diskError) console.warn(`[SuiteController] Disk sync warning after deleteTestCase: ${diskError}`);

  return res.json({ success: true, suite });
}

async function reorderSuiteTestCasesHandler(req, res) {
  const { projectId, suiteId } = req.params;
  ensureUuid(projectId, 'projectId');
  ensureUuid(suiteId, 'suiteId');

  const reorderItems = validateReorderPayload(req.body);
  const suite        = await suiteRepository.reorderTestCases(projectId, suiteId, reorderItems);
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
