require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { WebSocketServer } = require('ws');

const { extractPageStructure } = require('./seleniumService');
const { generateTestScript } = require('./aiService');
const { runMochaTest } = require('./testRunnerService');
const { saveObject, loadObject, listObjects, updateObject, deleteObject } = require('./objectRepository');
const { startSpySession, stopSpySession, handleSpyCapture, getSpyStatus, setWsBroadcast } = require('./objectSpyService');
const { getHealingReport, clearHealingLog } = require('./selfHealingEngine');
const { runEnhancedTest, listReports, getReport, SCREENSHOTS_DIR } = require('./enhancedTestRunner');
const { createSuite, listSuites, getSuite, updateSuite, deleteSuite, saveSuiteRunResult } = require('./testSuiteManager');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve screenshots dưới dạng static files
app.use('/api/screenshots', express.static(SCREENSHOTS_DIR));

// ==================== Tạo HTTP Server + WebSocket ====================
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Quản lý WebSocket clients
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log(`[WS] Client kết nối. Tổng: ${wsClients.size}`);

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`[WS] Client ngắt kết nối. Tổng: ${wsClients.size}`);
  });

  // Gửi trạng thái spy hiện tại cho client mới
  ws.send(JSON.stringify({ type: 'spy_status', ...getSpyStatus() }));
});

// Hàm broadcast cho tất cả clients
function broadcastToClients(data) {
  const message = JSON.stringify(data);
  for (const client of wsClients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

// Đăng ký broadcast function cho spy service
setWsBroadcast(broadcastToClients);

// ==================== EXISTING API ====================

app.post('/api/extract', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  
  try {
    const data = await extractPageStructure(url);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-script', async (req, res) => {
  const { html, description, url } = req.body;
  if (!html || !description || !url) return res.status(400).json({ error: 'Missing parameters' });
  
  try {
    const script = await generateTestScript(html, description, url);
    res.json({ success: true, script });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ENHANCED TEST RUNNER ====================

app.post('/api/run-test', async (req, res) => {
  const { script } = req.body;
  if (!script) return res.status(400).json({ error: 'Script is required' });
  
  try {
    clearHealingLog();
    const result = await runEnhancedTest(script, broadcastToClients);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== REPORTS API ====================

app.get('/api/reports', (req, res) => {
  try {
    const reports = listReports();
    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/:runId', (req, res) => {
  try {
    const report = getReport(req.params.runId);
    if (!report) return res.status(404).json({ error: 'Report không tồn tại' });
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TEST SUITES API ====================

app.get('/api/suites', (req, res) => {
  try {
    const suites = listSuites();
    res.json({ success: true, suites });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/suites/:id', (req, res) => {
  try {
    const suite = getSuite(req.params.id);
    if (!suite) return res.status(404).json({ error: 'Suite không tồn tại' });
    res.json({ success: true, suite });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/suites', (req, res) => {
  try {
    const suite = createSuite(req.body);
    res.json({ success: true, suite });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/suites/:id', (req, res) => {
  try {
    const suite = updateSuite(req.params.id, req.body);
    if (!suite) return res.status(404).json({ error: 'Suite không tồn tại' });
    res.json({ success: true, suite });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/suites/:id', (req, res) => {
  try {
    const result = deleteSuite(req.params.id);
    if (!result) return res.status(404).json({ error: 'Suite không tồn tại' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== OBJECT REPOSITORY API ====================

app.get('/api/objects', (req, res) => {
  try {
    const objects = listObjects();
    res.json({ success: true, objects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/objects/:id', (req, res) => {
  try {
    const obj = loadObject(req.params.id);
    if (!obj) return res.status(404).json({ error: 'Object không tồn tại' });
    res.json({ success: true, object: obj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/objects', (req, res) => {
  try {
    const obj = saveObject(req.body);
    res.json({ success: true, object: obj });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/objects/:id', (req, res) => {
  try {
    const obj = updateObject(req.params.id, req.body);
    if (!obj) return res.status(404).json({ error: 'Object không tồn tại' });
    res.json({ success: true, object: obj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/objects/:id', (req, res) => {
  try {
    const result = deleteObject(req.params.id);
    if (!result) return res.status(404).json({ error: 'Object không tồn tại' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== OBJECT SPY API ====================

app.post('/api/spy/start', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const result = await startSpySession(url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/spy/stop', async (req, res) => {
  try {
    const result = await stopSpySession();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/spy/capture', (req, res) => {
  try {
    const result = handleSpyCapture(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/spy/stopped', async (req, res) => {
  try {
    await stopSpySession();
    res.json({ success: true });
  } catch (error) {
    res.json({ success: true });
  }
});

app.get('/api/spy/status', (req, res) => {
  res.json({ success: true, ...getSpyStatus() });
});

// ==================== SELF-HEALING API ====================

app.get('/api/healing/report', (req, res) => {
  try {
    const report = getHealingReport();
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
  console.log(`WebSocket server is running on ws://localhost:${PORT}/ws`);
});
