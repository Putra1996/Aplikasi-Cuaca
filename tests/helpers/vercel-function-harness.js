'use strict';

// Harness uji: membungkus handler api/*.js persis seperti runtime @vercel/node
// (satu handler (req, res) per rute) di dalam server HTTP lokal.
// Dijalankan sebagai child process agar lib/openweather.js membaca env yang baru.

const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const weather = require(path.join(root, 'api', 'weather.js'));
const health = require(path.join(root, 'api', 'health.js'));

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/api/weather') return weather(request, response);
  if (pathname === '/api/health') return health(request, response);
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end('{"error":"not found"}');
});

server.listen(0, '127.0.0.1', () => {
  console.log('harness listening on 127.0.0.1:' + server.address().port);
});
