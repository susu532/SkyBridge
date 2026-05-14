const { Worker, isMainThread, parentPort } = require('worker_threads');
const net = require('net');
const http = require('http');

if (isMainThread) {
  const worker = new Worker(__filename);
  const server = http.createServer((req, res) => res.end('OK'));
  server.on('upgrade', (req, socket, head) => {
    try {
      worker.postMessage({ type: 'socket' }, [socket]);
      console.log('Passed socket successfully!');
    } catch (e) {
      console.error('Failed to pass socket:', e.message);
    }
  });
  server.listen(3001, () => {
    http.get('http://localhost:3001', { headers: { 'Connection': 'Upgrade', 'Upgrade': 'websocket' } });
  });
} else {
  parentPort.on('message', () => {
    console.log('Worker got message');
    process.exit(0);
  });
}
