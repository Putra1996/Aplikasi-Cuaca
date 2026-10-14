'use strict';

// Audit 14 Okt 2026 — regresi lapisan variabel opsional Open-Meteo:
// bila API menolak variabel tambahan (wind gust/visibility/sunrise/sunset), permintaan harus
// diulang tanpa variabel tersebut sehingga data live tetap mengalir — dan nilai yang tidak
// tersedia tetap null/‘—’, bukan angka karangan seperti sebelum audit.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');

const CHILD_SCRIPT = `
const http = require('node:http');
let optionalAttempts = 0;
let requiredAttempts = 0;
const forecast = {
  current: {
    time: '2026-10-14T11:00', temperature_2m: 30.4, relative_humidity_2m: 70, apparent_temperature: 34.1,
    precipitation: 0, weather_code: 1, surface_pressure: 1008, wind_speed_10m: 9.4, wind_direction_10m: 145,
    uv_index: 7.6, cloud_cover: 20, is_day: 1
  },
  hourly: {
    time: ['2026-10-14T11:00'],
    temperature_2m: [30.4], relative_humidity_2m: [70], precipitation_probability: [10], precipitation: [0],
    weather_code: [1], uv_index: [7.6], cloud_cover: [20], wind_speed_10m: [9.4]
  },
  daily: {
    time: ['2026-10-14'], weather_code: [2], temperature_2m_max: [31.2], temperature_2m_min: [24.1],
    uv_index_max: [8.5], precipitation_sum: [0.2], precipitation_probability_max: [45], wind_speed_10m_max: [14.2]
  }
};
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname !== '/v1/forecast') {
    response.writeHead(404, { 'content-type': 'application/json' });
    return response.end('{"reason":"not found"}');
  }
  const requested = (url.searchParams.get('current') || '') + (url.searchParams.get('hourly') || '') + (url.searchParams.get('daily') || '');
  if (requested.includes('wind_gusts_10m') || requested.includes('visibility') || requested.includes('sunrise')) {
    optionalAttempts += 1;
    response.writeHead(400, { 'content-type': 'application/json' });
    return response.end('{"reason":"Variable is not available for this model"}');
  }
  requiredAttempts += 1;
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(forecast));
});
server.listen(0, '127.0.0.1', async () => {
  process.env.OPEN_METEO_WEATHER_BASE = 'http://127.0.0.1:' + server.address().port;
  const provider = require(process.env.SEKITARKU_MODULE);
  try {
    const weather = await provider.fetchOpenMeteoWeather(-7.42, 109.24, true);
    const compat = provider.buildCuacaKuCompatibleWeather(
      { name: 'Klumprit', province: 'Jawa Tengah', lat: -7.42, lon: 109.24 }, weather, null
    );
    console.log(JSON.stringify({ optionalAttempts, requiredAttempts, weather, compat }));
    server.close();
  } catch (error) {
    console.log(JSON.stringify({ error: String(error && error.message || error) }));
    server.close();
    process.exitCode = 1;
  }
});
`;

function runChild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', CHILD_SCRIPT], {
      cwd: root,
      env: { ...process.env, SEKITARKU_MODULE: path.join(root, 'lib/sekitarku.js') },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    let errors = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('child timed out: ' + output + errors));
    }, 10000);
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { errors += chunk.toString(); });
    child.on('exit', () => {
      clearTimeout(timer);
      const line = output.trim().split('\n').filter(Boolean).pop();
      if (!line) return reject(new Error('no output: ' + errors));
      try {
        resolve(JSON.parse(line));
      } catch (error) {
        reject(new Error('bad output: ' + output + errors));
      }
    });
  });
}

test('permintaan Open-Meteo diulang tanpa variabel opsional dan tidak mengarang nilai yang hilang', async () => {
  const result = await runChild();
  assert.ok(!result.error, 'child gagal: ' + result.error);
  assert.equal(result.optionalAttempts, 1, 'percobaan pertama memakai variabel opsional lalu ditolak API');
  assert.ok(result.requiredAttempts >= 1, 'permintaan ulang tanpa variabel opsional harus dilakukan');

  assert.equal(result.weather.live, true, 'data live tetap tersedia walau variabel opsional ditolak');
  assert.equal(result.weather.current.windGust, null);
  assert.equal(result.weather.current.visibilityKm, null);

  assert.equal(result.compat.live, true);
  assert.equal(result.compat.aqiLive, false);
  assert.equal(result.compat.current.sunrise, '—');
  assert.equal(result.compat.current.sunset, '—');
  assert.equal(result.compat.current.visibility, null);
  assert.equal(result.compat.current.wind.gust, null);
  assert.equal(result.compat.current.wind.speed, 9);
  assert.equal(result.compat.dailyForecast.length, 1);
});
