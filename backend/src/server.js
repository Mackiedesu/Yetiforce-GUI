require('dotenv').config();
const http = require('http');
const { WebSocketServer } = require('ws');

const { PORT } = require('./config/env');
const { ensureDatabaseReady } = require('./config/database');
const { createApp } = require('./app');
const { createWsHub } = require('./websocket/wsHub');
const { setSpyBroadcast, getSpyStatus } = require('./controllers/spy.controller');
const { setAutomationBroadcast } = require('./controllers/automation.controller');
const { setExecutionBroadcast } = require('./modules/executions/interface/http/execution.controller');
const { ensureTablesExist } = require('./modules/executions/infrastructure/execution.repository.pg');

const app = createApp();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const wsHub = createWsHub();

wsHub.attach(wss, getSpyStatus);
setSpyBroadcast(wsHub.broadcast);
setAutomationBroadcast(wsHub.broadcast);
setExecutionBroadcast(wsHub.broadcast);

async function startServer() {
  try {
    await ensureDatabaseReady();
    console.log('PostgreSQL connection is ready.');
    await ensureTablesExist();
    console.log('Katalon execution tables ready.');
  } catch (error) {
    console.error('Không thể kết nối PostgreSQL:', error.message);
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
    console.log(`WebSocket server is running on ws://localhost:${PORT}/ws`);
  });
}

startServer();
