'use strict';

// Vercel Serverless Function: GET /api/widget
// Endpoint ringan JSON untuk PWA Widget & Android KWGT / Tasker Widget.

const { URL } = require('node:url');
const { getWidgetPayload } = require('../lib/sekitarku.js');

module.exports = async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
    response.end('Method not allowed');
    return;
  }
  try {
    const reqUrl = new URL(request.url || '/api/widget', 'http://' + (request.headers && request.headers.host || 'localhost'));
    const payload = await getWidgetPayload({
      lat: reqUrl.searchParams.get('lat'),
      lon: reqUrl.searchParams.get('lon'),
      city: reqUrl.searchParams.get('city'),
      name: reqUrl.searchParams.get('name')
    });
    const body = JSON.stringify(payload, null, 2);
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      'access-control-allow-origin': '*',
      'x-content-type-options': 'nosniff',
      'content-length': Buffer.byteLength(body)
    });
    response.end(body);
  } catch (error) {
    const body = JSON.stringify({ error: 'WIDGET_UNAVAILABLE' });
    response.writeHead(502, {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*'
    });
    response.end(body);
  }
};
