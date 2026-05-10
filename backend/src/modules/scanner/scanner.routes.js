const express = require('express');
const { asyncHandler } = require('../../utils/asyncHandler');
const { scanPageHandler, generateFromScanHandler } = require('./scanner.controller');

const router = express.Router();

router.post('/scan', asyncHandler(scanPageHandler));
router.post('/generate', asyncHandler(generateFromScanHandler));

module.exports = { scannerRouter: router };
