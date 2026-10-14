'use strict';

// Vercel Serverless Function: GET /api/weather
// Proxy OpenWeather server-side — API key tidak pernah menyentuh browser.
// Mendukung parameter opsional ?lat=...&lon=...&name=...&region=...&city=... untuk 515+ kota Indonesia & GPS.

const { URL } = require('node:url');
const { getCachedWeather, sendJson, apiError } = require('../lib/openweather.js');

module.exports = async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
    response.end('Method not allowed');
    return;
  }
  try {
    const reqUrl = new URL(request.url || '/api/weather', 'http://' + (request.headers && request.headers.host || 'localhost'));
    const options = {
      lat: reqUrl.searchParams.get('lat'),
      lon: reqUrl.searchParams.get('lon'),
      city: reqUrl.searchParams.get('city'),
      name: reqUrl.searchParams.get('name'),
      region: reqUrl.searchParams.get('region')
    };
    const payload = await getCachedWeather(options);
    sendJson(response, 200, payload);
  } catch (error) {
    apiError(response, error);
  }
};
