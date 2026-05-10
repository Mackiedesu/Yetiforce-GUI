const { extractPageStructure } = require('../services/selenium/extractPageStructure.service');
const { generateTestScript } = require('../services/ai/generateScript.service');
const { generateKatalonTest } = require('../services/ai/generateKatalonTest.service');
const { runEnhancedTest, listReports, getReport } = require('../services/testing/enhancedTestRunner.service');
const { clearHealingLog, getHealingReport } = require('../services/healing/selfHealing.service');

let wsBroadcast = null;

function setAutomationBroadcast(broadcastFn) {
  wsBroadcast = broadcastFn;
}

function getBroadcast() {
  return wsBroadcast;
}

async function extractPageStructureHandler(req, res) {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const data = await extractPageStructure(url);
  return res.json({ success: true, ...data });
}

async function generateScriptHandler(req, res) {
  const { html, description, url } = req.body;
  if (!html || !description || !url) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const script = await generateTestScript(html, description, url);
  return res.json({ success: true, script });
}

async function generateKatalonTestHandler(req, res) {
  const { requirement } = req.body;
  if (!requirement || !requirement.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập yêu cầu kiểm thử.' });
  }

  const result = await generateKatalonTest(requirement.trim());
  return res.json({ success: true, ...result });
}

async function runTestHandler(req, res) {
  const { script } = req.body;
  if (!script) {
    return res.status(400).json({ error: 'Script is required' });
  }

  clearHealingLog();
  const result = await runEnhancedTest(script, getBroadcast());
  return res.json({ success: true, result });
}

function listReportsHandler(req, res) {
  const reports = listReports();
  return res.json({ success: true, reports });
}

function getReportHandler(req, res) {
  const report = getReport(req.params.runId);
  if (!report) {
    return res.status(404).json({ error: 'Report không tồn tại' });
  }

  return res.json({ success: true, report });
}

function getHealingReportHandler(req, res) {
  const report = getHealingReport();
  return res.json({ success: true, report });
}

module.exports = {
  setAutomationBroadcast,
  extractPageStructureHandler,
  generateScriptHandler,
  generateKatalonTestHandler,
  runTestHandler,
  listReportsHandler,
  getReportHandler,
  getHealingReportHandler
};
