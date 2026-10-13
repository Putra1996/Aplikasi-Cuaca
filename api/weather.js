'use strict';

// Vercel Serverless Function: GET /api/weather
// Proxy OpenWeather server-side — API key tidak pernah menyentuh browser.

const { getCachedWeather, sendJson, apiError } = require('../lib/openweather.js');

module.exports = async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
    response.end('Method not allowed');
    return;
  }
  try {
    const payload = await getCachedWeather();
    sendJson(response, 200, payload);
  } catch (error) {
    apiError(response, error);
  }
};
