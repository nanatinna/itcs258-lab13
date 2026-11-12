// Zero-dependency static server for the visual tester: `npm start` or `node serve.js [port]`.
// Origin becomes http://localhost:5500 — add that to the backend's CORS_ORIGINS.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.argv[2] || process.env.TESTER_PORT || 5500);
// 127.0.0.1 on a laptop. compose.cors.yml sets TESTER_HOST=0.0.0.0 so Docker can publish the port.
const host = process.env.TESTER_HOST || '127.0.0.1';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(root + path.sep) || !types[path.extname(file)]) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, host, () => console.log(`Visual tester: http://localhost:${port}/  (origin http://localhost:${port})`));
