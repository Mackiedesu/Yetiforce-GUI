const express = require('express');
const { asyncHandler } = require('../../../../utils/asyncHandler');
const {
  startExecutionHandler,
  listExecutionsHandler,
  getStatsHandler,
  getExecutionHandler,
  deleteExecutionHandler,
} = require('./execution.controller');

const router = express.Router();

router.post('/', asyncHandler(startExecutionHandler));
router.get('/stats', asyncHandler(getStatsHandler));
router.get('/', asyncHandler(listExecutionsHandler));
router.get('/:id', asyncHandler(getExecutionHandler));
router.delete('/:id', asyncHandler(deleteExecutionHandler));

module.exports = { executionRouter: router };
