const express = require('express');
const cors = require('cors');

const { SCREENSHOTS_DIR } = require('./config/paths');
const { apiRouter } = require('./routes/api.routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/screenshots', express.static(SCREENSHOTS_DIR));
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp
};
