const express = require('express');

const { asyncHandler } = require('../../../../utils/asyncHandler');
const {
  listProjectSuitesHandler,
  getProjectSuiteHandler,
  createProjectSuiteHandler,
  updateProjectSuiteHandler,
  deleteProjectSuiteHandler,
  addSuiteTestCaseHandler,
  updateSuiteTestCaseHandler,
  deleteSuiteTestCaseHandler,
  reorderSuiteTestCasesHandler
} = require('./testSuite.controller');

const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(listProjectSuitesHandler));
router.post('/', asyncHandler(createProjectSuiteHandler));
router.get('/:suiteId', asyncHandler(getProjectSuiteHandler));
router.put('/:suiteId', asyncHandler(updateProjectSuiteHandler));
router.delete('/:suiteId', asyncHandler(deleteProjectSuiteHandler));

router.post('/:suiteId/test-cases', asyncHandler(addSuiteTestCaseHandler));
router.put('/:suiteId/test-cases/:testCaseId', asyncHandler(updateSuiteTestCaseHandler));
router.delete('/:suiteId/test-cases/:testCaseId', asyncHandler(deleteSuiteTestCaseHandler));
router.patch('/:suiteId/reorder', asyncHandler(reorderSuiteTestCasesHandler));

module.exports = {
  projectSuiteRouter: router
};
