const express = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const {
  generateHandler,
  scanUrlHandler,
  generateFromDomHandler,
  saveBatchHandler,
} = require('./aiAgent.controller');

const router = express.Router();

// Legacy text-based generation (kept for backward compatibility)
router.post('/generate', asyncHandler(generateHandler));

// Unified AI QA Studio workflow
router.post('/scan-url',           asyncHandler(scanUrlHandler));
router.post('/generate-from-dom',  asyncHandler(generateFromDomHandler));
router.post('/save',               asyncHandler(saveBatchHandler));

module.exports = { aiAgentRouter: router };
