const {
  createSuite,
  listSuites,
  getSuite,
  updateSuite,
  deleteSuite
} = require('../repositories/suite.repository');

function listSuitesHandler(req, res) {
  const suites = listSuites();
  return res.json({ success: true, suites });
}

function getSuiteHandler(req, res) {
  const suite = getSuite(req.params.id);
  if (!suite) {
    return res.status(404).json({ error: 'Suite không tồn tại' });
  }

  return res.json({ success: true, suite });
}

function createSuiteHandler(req, res) {
  const suite = createSuite(req.body);
  return res.json({ success: true, suite });
}

function updateSuiteHandler(req, res) {
  const suite = updateSuite(req.params.id, req.body);
  if (!suite) {
    return res.status(404).json({ error: 'Suite không tồn tại' });
  }

  return res.json({ success: true, suite });
}

function deleteSuiteHandler(req, res) {
  const isDeleted = deleteSuite(req.params.id);
  if (!isDeleted) {
    return res.status(404).json({ error: 'Suite không tồn tại' });
  }

  return res.json({ success: true });
}

module.exports = {
  listSuitesHandler,
  getSuiteHandler,
  createSuiteHandler,
  updateSuiteHandler,
  deleteSuiteHandler
};
