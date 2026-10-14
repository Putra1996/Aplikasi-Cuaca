'use strict';

// Tes fungsi serverless Vercel (api/weather.js & api/health.js):
// dipanggil sebagai handler (req, res) — bukan lewat scripts/dev-server.js —
// memastikan jalur deploy Vercel benar-benar berfungsi dengan mock OpenWeather.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const { startMockOpenMeteo, reserveClosedPort } = require('./helpers/openmeteo-mock.js');

function startMockOpenWeather() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const nowBase = Math.floor(Date.now() / 1000);
    const respond = body => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    if (url.pathname === '/data/4.0/onecall/current') {
      return respond({
        lat: -7.42, lon: 109.24, timezone: 'Asia/Jakarta', timezone_offset: 25200,
        data: [{ dt: nowBase, sunrise: nowBase - 20000, sunset: nowBase + 15000, temp: 77, feels_like: 81, pressure: 1010, humidity: 88, dew_point: 73, uvi: 3.2, clouds: 70, visibility: 9000, wind_speed: 8, wind_deg: 200, weather: [{ id: 701, main: 'Mist', description: 'berkabut', icon: '50d' }] }]
      });
    }
    if (url.pathname === '/data/4.0/onecall/timeline/1min') {
      return respond({
        data: Array.from({ length: 10 }, (_, i) => ({ dt: nowBase + i * 60, precipitation: 0, pop: i === 5 ? 0.42 : 0.02 }))
      });
    }
    if (url.pathname === '/data/4.0/onecall/timeline/1h') {
      return respond({
        data: Array.from({ length: 8 }, (_, i) => ({ dt: nowBase + i * 3600, temp: 76 + i, humidity: 80, pop: 0.1, wind_speed: 6, weather: [{ description: 'hujan ringan', icon: '10d' }] }))
      });
    }
    if (url.pathname === '/data/4.0/onecall/timeline/1day') {
      return respond({
        data: Array.from({ length: 10 }, (_, i) => ({ dt: nowBase + i * 86400, temp: { min: 72, max: 89 }, humidity: 78, wind_speed: 7, pop: 0.35, uvi: 9.5, weather: [{ description: 'hujan ringan', icon: '10d' }] }))
      });
    }
    if (url.pathname === '/data/2.5/air_pollution') {
      return respond({ list: [{ main: { aqi: 3 }, components: { co: 500, no2: 20, o3: 40, so2: 8, pm2_5: 55, pm10: 90 }, dt: nowBase }] });
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end('{"cod":"404"}');
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function spawnHarness(providerPort, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tests/helpers/vercel-function-harness.js'], {
      cwd: root,
      env: {
        ...process.env,
        OPENWEATHER_API_KEY: 'vercel-fn-test-key',
        OPENWEATHER_API_BASE: 'http://127.0.0.1:' + providerPort,
        OPENWEATHER_REFRESH_SECONDS: '600',
        ...extraEnv
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('harness did not start: ' + output));
    }, 8000);
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/harness listening on 127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve({ child, port: Number(match[1]) });
      }
    });
    child.on('exit', code => {
      clearTimeout(timer);
      reject(new Error('harness exited early (' + code + '): ' + output));
    });
  });
}

test('Vercel function api/weather.js serves a live payload through the OpenWeather proxy', async (t) => {
  const mock = await startMockOpenWeather();
  t.after(() => new Promise(resolve => mock.close(resolve)));
  const { child, port } = await spawnHarness(mock.address().port);
  t.after(() => new Promise(resolve => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
  }));

  const response = await fetch('http://127.0.0.1:' + port + '/api/weather');
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.meta.live, true);
  assert.equal(payload.provider.name, 'OpenWeather');
  assert.equal(payload.current.temp, 77);
  assert.equal(payload.dailyForecast.length, 10);
  assert.equal(payload.minuteCast.precipitationProbability[5], 42);
  assert.ok(!JSON.stringify(payload).includes('vercel-fn-test-key'), 'API key must never leak to the client');

  const health = await fetch('http://127.0.0.1:' + port + '/api/health');
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.configured, true);
  assert.ok(!JSON.stringify(healthBody).includes('vercel-fn-test-key'));
});

test('Vercel function api/weather.js serves live Open-Meteo data when no OpenWeather key is set', async (t) => {
  const mock = await startMockOpenWeather();
  t.after(() => new Promise(resolve => mock.close(resolve)));
  const openMeteo = await startMockOpenMeteo();
  t.after(() => new Promise(resolve => openMeteo.close(resolve)));
  const openMeteoBase = 'http://127.0.0.1:' + openMeteo.address().port;
  const { child, port } = await spawnHarness(mock.address().port, {
    OPENWEATHER_API_KEY: '',
    OPEN_METEO_WEATHER_BASE: openMeteoBase,
    OPEN_METEO_AQI_BASE: openMeteoBase,
    BMKG_API_BASE: openMeteoBase
  });
  t.after(() => new Promise(resolve => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
  }));

  const response = await fetch('http://127.0.0.1:' + port + '/api/weather');
  assert.equal(response.status, 200, 'tanpa key OpenWeather, dashboard tetap live lewat Open-Meteo');
  const body = await response.json();
  assert.equal(body.meta.live, true);
  assert.equal(body.meta.source, 'Open-Meteo');
  assert.equal(body.meta.fallback.from, 'OpenWeather');
  assert.equal(body.meta.fallback.attempts[0].code, 'OPENWEATHER_API_KEY_NOT_CONFIGURED');
  assert.equal(body.airQuality.scale, 'US-EPA AQI (Open-Meteo)');
  assert.equal(body.provider.modules.minuteCast.live, false);

  const health = await fetch('http://127.0.0.1:' + port + '/api/health');
  const healthBody = await health.json();
  assert.equal(healthBody.configured, false);
  assert.equal(healthBody.providers.fallback.enabled, true);
  assert.equal(healthBody.providers.fallback.requiresKey, false);
  assert.equal(healthBody.lastFetch.provider, 'Open-Meteo');
});

test('Vercel function api/weather.js reports a clear 502 when both providers fail', async (t) => {
  const mock = await startMockOpenWeather();
  t.after(() => new Promise(resolve => mock.close(resolve)));
  const closedPort = await reserveClosedPort();
  const closedBase = 'http://127.0.0.1:' + closedPort;
  const { child, port } = await spawnHarness(mock.address().port, {
    OPENWEATHER_API_KEY: 'vercel-fn-test-key',
    OPENWEATHER_API_BASE: closedBase,
    OPEN_METEO_WEATHER_BASE: closedBase,
    OPEN_METEO_AQI_BASE: closedBase,
    BMKG_API_BASE: closedBase
  });
  t.after(() => new Promise(resolve => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
  }));

  const response = await fetch('http://127.0.0.1:' + port + '/api/weather');
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.error.code, 'WEATHER_PROVIDERS_UNAVAILABLE');
  assert.equal(body.attempts.length, 2);
  assert.ok(!JSON.stringify(body).includes('vercel-fn-test-key'));
});
