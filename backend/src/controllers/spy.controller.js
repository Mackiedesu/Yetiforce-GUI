const {
  startSpySession,
  stopSpySession,
  handleSpyCapture,
  getSpyStatus,
  setWsBroadcast
} = require('../services/spy/spySession.service');

function setSpyBroadcast(broadcastFn) {
  setWsBroadcast(broadcastFn);
}

async function startSpyHandler(req, res) {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const result = await startSpySession(url);
  return res.json(result);
}

async function stopSpyHandler(req, res) {
  const result = await stopSpySession();
  return res.json(result);
}

function captureSpyHandler(req, res) {
  const result = handleSpyCapture(req.body);
  return res.json(result);
}

async function spyStoppedHandler(req, res) {
  try {
    await stopSpySession();
    return res.json({ success: true });
  } catch (error) {
    return res.json({ success: true });
  }
}

function getSpyStatusHandler(req, res) {
  return res.json({ success: true, ...getSpyStatus() });
}

module.exports = {
  setSpyBroadcast,
  startSpyHandler,
  stopSpyHandler,
  captureSpyHandler,
  spyStoppedHandler,
  getSpyStatusHandler,
  getSpyStatus
};
