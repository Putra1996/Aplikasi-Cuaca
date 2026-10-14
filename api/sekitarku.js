'use strict';

// Vercel Serverless Function: GET /api/sekitarku
// Menggabungkan data real-time BMKG (Auto-Gempa & Tsunami), Open-Meteo (Cuaca, UV, US-EPA AQI & Polutan),
// PVMBG/MAGMA (Gunung Api Terdekat), FDRS Karhutla, Skor Lingkungan Eco-Health (0-100) & Konversi Rokok Pasif.

const { URL } = require('node:url');
const { sendJson } = require('../lib/openweather.js');
const { getSekitarkuBundle } = require('../lib/sekitarku.js');

module.exports = async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
    response.end('Method not allowed');
    return;
  }
  try {
    const reqUrl = new URL(request.url || '/api/sekitarku', 'http://' + (request.headers && request.headers.host || 'localhost'));
    const params = {
      lat: reqUrl.searchParams.get('lat'),
      lon: reqUrl.searchParams.get('lon'),
      city: reqUrl.searchParams.get('city'),
      name: reqUrl.searchParams.get('name'),
      province: reqUrl.searchParams.get('province'),
      region: reqUrl.searchParams.get('region'),
      force: reqUrl.searchParams.get('force') === '1' || reqUrl.searchParams.get('force') === 'true'
    };
    const payload = await getSekitarkuBundle(params);
    sendJson(response, 200, payload);
  } catch (error) {
    sendJson(response, 502, {
      error: { code: 'SEKITARKU_FETCH_FAILED', message: 'Gagal memuat bundel data lingkungan.' }
    });
  }
};
