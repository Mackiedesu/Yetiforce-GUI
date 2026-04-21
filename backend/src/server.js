require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { extractPageStructure } = require('./seleniumService');
const { generateTestScript } = require('./aiService');
const { runMochaTest } = require('./testRunnerService');

const app = express();
app.use(cors());
app.use(express.json());

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

app.post('/api/run-test', async (req, res) => {
  const { script } = req.body;
  if (!script) return res.status(400).json({ error: 'Script is required' });
  
  try {
    const result = await runMochaTest(script);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
