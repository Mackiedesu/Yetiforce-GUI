const express = require('express');

const { asyncHandler } = require('../../../../utils/asyncHandler');
const {
  listProjectTestCasesHandler,
  getProjectTestCaseHandler,
  createProjectTestCaseHandler,
  updateProjectTestCaseHandler,
  deleteProjectTestCaseHandler
} = require('./testCase.controller');

const router = express.Router({ mergeParams: true });

router.get('/', asyncHandler(listProjectTestCasesHandler));
router.post('/', asyncHandler(createProjectTestCaseHandler));
router.get('/:testCaseId', asyncHandler(getProjectTestCaseHandler));
router.put('/:testCaseId', asyncHandler(updateProjectTestCaseHandler));
router.delete('/:testCaseId', asyncHandler(deleteProjectTestCaseHandler));

module.exports = {
  projectTestCaseRouter: router
};
