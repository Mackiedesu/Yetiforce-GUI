function createWsHub() {
  const wsClients = new Set();

  function attach(wss, getSpyStatus) {
    wss.on('connection', (ws) => {
      wsClients.add(ws);
      console.log(`[WS] Client kết nối. Tổng: ${wsClients.size}`);

      ws.on('close', () => {
        wsClients.delete(ws);
        console.log(`[WS] Client ngắt kết nối. Tổng: ${wsClients.size}`);
      });

      if (typeof getSpyStatus === 'function') {
        ws.send(JSON.stringify({ type: 'spy_status', ...getSpyStatus() }));
      }
    });
  }

  function broadcast(data) {
    const message = JSON.stringify(data);
    for (const client of wsClients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }

  return {
    attach,
    broadcast
  };
}

module.exports = {
  createWsHub
};
