const express = require('express');

const { asyncHandler } = require('../../../../utils/asyncHandler');
const {
  listProjectsHandler,
  getProjectHandler,
  createProjectHandler,
  updateProjectHandler,
  deleteProjectHandler,
  importProjectHandler,
  getProjectStructureHandler,
  generateProjectHandler,
  scanProjectSuitesHandler,
} = require('./project.controller');
const { projectSuiteRouter } = require('../../../test-suites/interface/http/testSuite.routes');
const { projectTestCaseRouter } = require('../../../test-cases/interface/http/testCase.routes');

const router = express.Router();

router.get('/',          asyncHandler(listProjectsHandler));
router.post('/',         asyncHandler(createProjectHandler));
router.post('/import',   asyncHandler(importProjectHandler));
router.post('/generate', asyncHandler(generateProjectHandler));

router.get('/:id',           asyncHandler(getProjectHandler));
router.put('/:id',           asyncHandler(updateProjectHandler));
router.delete('/:id',        asyncHandler(deleteProjectHandler));
router.get('/:id/structure', asyncHandler(getProjectStructureHandler));
router.get('/:id/scan-suites', asyncHandler(scanProjectSuitesHandler));

router.use('/:projectId/suites', projectSuiteRouter);
router.use('/:projectId/test-cases', projectTestCaseRouter);

module.exports = {
  projectRouter: router
};
