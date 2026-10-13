'use strict';

// Server pengembangan/produksi self-host (Railway/Render/VPS):
// menyajikan file statis + proxy OpenWeather yang sama dengan fungsi Vercel.
// Jalankan: npm start (atau: node scripts/dev-server.js)

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const { getCachedWeather, sendJson, apiError, healthPayload } = require('../lib/openweather.js');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT != null && String(process.env.PORT).trim() !== '' ? Number(process.env.PORT) : 8000;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_BYTES = 1_000_000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function safePublicPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch (error) { return null; }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(ROOT, relative);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;
  if (path.basename(resolved).startsWith('.')) return null;
  return resolved;
}

function serveStatic(request, response, pathname) {
  const filePath = safePublicPath(pathname);
  if (!filePath) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' });
    response.end('Not found');
    return;
  }
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile() || stats.size > MAX_BODY_BYTES) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' });
      response.end('Not found');
      return;
    }
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()];
    if (!type) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'content-type': type,
      'content-length': stats.size,
      'cache-control': path.extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=300',
      'x-content-type-options': 'nosniff'
    });
    if (request.method === 'HEAD') return response.end();
    fs.createReadStream(filePath).pipe(response);
  });
}

function createServer() {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, 'http://' + (request.headers.host || 'localhost'));
    const pathname = requestUrl.pathname;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed');
      return;
    }
    if (pathname === '/api/health') {
      sendJson(response, 200, healthPayload());
      return;
    }
    if (pathname === '/api/weather') {
      try {
        const payload = await getCachedWeather();
        sendJson(response, 200, payload);
      } catch (error) {
        apiError(response, error);
      }
      return;
    }
    if (pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } });
      return;
    }
    serveStatic(request, response, pathname);
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    const address = server.address();
    console.log('CuacaKu listening on ' + HOST + ':' + (address && address.port || PORT) + ' · OpenWeather key ' + (healthPayload().configured ? 'configured' : 'not configured') + ' · cache ' + healthPayload().refreshIntervalSeconds + 's');
  });
  server.on('error', error => {
    console.error('Server failed to start: ' + error.code);
    process.exitCode = 1;
  });
}

module.exports = { createServer };
