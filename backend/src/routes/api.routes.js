const express = require('express');

const { asyncHandler } = require('../utils/asyncHandler');
const { loginHandler } = require('../controllers/auth.controller');
const {
  extractPageStructureHandler,
  generateScriptHandler,
  generateKatalonTestHandler,
  runTestHandler,
  listReportsHandler,
  getReportHandler,
  getHealingReportHandler
} = require('../controllers/automation.controller');
const {
  listObjectsHandler,
  getObjectHandler,
  createObjectHandler,
  updateObjectHandler,
  deleteObjectHandler
} = require('../controllers/object.controller');
const {
  startSpyHandler,
  stopSpyHandler,
  captureSpyHandler,
  spyStoppedHandler,
  getSpyStatusHandler
} = require('../controllers/spy.controller');
const { projectRouter } = require('../modules/projects/interface/http/project.routes');
const { executionRouter } = require('../modules/executions/interface/http/execution.routes');
const { aiAgentRouter } = require('../modules/ai-agent/aiAgent.routes');
const { scannerRouter } = require('../modules/scanner/scanner.routes');
const { fsBrowserRouter } = require('../modules/fs-browser/fsBrowser.routes');

const router = express.Router();

router.post('/auth/login', asyncHandler(loginHandler));

router.post('/extract', asyncHandler(extractPageStructureHandler));
router.post('/generate-script', asyncHandler(generateScriptHandler));
router.post('/generate-katalon-test', asyncHandler(generateKatalonTestHandler));
router.post('/run-test', asyncHandler(runTestHandler));

router.get('/reports', listReportsHandler);
router.get('/reports/:runId', getReportHandler);

router.get('/objects', listObjectsHandler);
router.get('/objects/:id', getObjectHandler);
router.post('/objects', createObjectHandler);
router.put('/objects/:id', updateObjectHandler);
router.delete('/objects/:id', deleteObjectHandler);

router.post('/spy/start', asyncHandler(startSpyHandler));
router.post('/spy/stop', asyncHandler(stopSpyHandler));
router.post('/spy/capture', captureSpyHandler);
router.post('/spy/stopped', asyncHandler(spyStoppedHandler));
router.get('/spy/status', getSpyStatusHandler);

router.get('/healing/report', getHealingReportHandler);

router.use('/projects',   projectRouter);
router.use('/executions', executionRouter);
router.use('/ai-agent',   aiAgentRouter);
router.use('/scanner',    scannerRouter);
router.use('/fs',         fsBrowserRouter);

module.exports = {
  apiRouter: router
};
