'use strict';

// Vercel Serverless Function: GET /api/health
// Menampilkan status konfigurasi tanpa membocorkan API key.

const { sendJson, healthPayload } = require('../lib/openweather.js');

module.exports = (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
    response.end('Method not allowed');
    return;
  }
  sendJson(response, 200, healthPayload());
};
