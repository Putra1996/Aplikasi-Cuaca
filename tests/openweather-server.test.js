'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

// Uji deterministik: penyedia cadangan diarahkan ke port tertutup SEBELUM modul dimuat,
// sehingga hasilnya tidak bergantung pada jaringan sandbox/CI (audit 14 Okt 2026).
process.env.OPEN_METEO_WEATHER_BASE = process.env.OPEN_METEO_WEATHER_BASE || 'http://127.0.0.1:1';
process.env.OPEN_METEO_AQI_BASE = process.env.OPEN_METEO_AQI_BASE || 'http://127.0.0.1:1';
process.env.BMKG_API_BASE = process.env.BMKG_API_BASE || 'http://127.0.0.1:1';

const libSource = fs.readFileSync(path.join(root, 'lib/openweather.js'), 'utf8');
const weatherFnSource = fs.readFileSync(path.join(root, 'api/weather.js'), 'utf8');
const healthFnSource = fs.readFileSync(path.join(root, 'api/health.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const {
  aqiCategory,
  normalizeAirQuality,
  normalizeDailyRecords,
  normalizeBasicDailyRecords,
  normalizeHourlyRecords,
  normalizeMinuteCast
} = require(path.join(root, 'lib/openweather.js'));
const { createServer } = require(path.join(root, 'scripts/dev-server.js'));

test('server keeps the OpenWeather key out of client-side code and public responses', () => {
  assert.match(libSource, /OPENWEATHER_API_KEY/);
  assert.doesNotMatch(appSource, /appid=/);
  assert.doesNotMatch(html, /appid=/);
  // No 32-hex API-key-shaped strings may appear in browser-facing files.
  assert.doesNotMatch(appSource, /\b[0-9a-f]{32}\b/);
  assert.doesNotMatch(html, /\b[0-9a-f]{32}\b/);
  assert.doesNotMatch(weatherFnSource, /\b[0-9a-f]{32}\b/);
  assert.doesNotMatch(healthFnSource, /\b[0-9a-f]{32}\b/);
  assert.match(libSource, /Do not log\/return the request URL or provider body/);
  assert.ok(fs.existsSync(path.join(root, '.gitignore')));
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /\.env/);
});

test('Vercel zero-config layout stays intact (regression guard for FUNCTION_INVOCATION_FAILED)', () => {
  // Sebuah file server.js/server.ts di root membuat Vercel mendeteksi framework "Node"
  // dan membungkus SELURUH situs sebagai satu function via @vercel/backends — penyebab
  // insiden 500 FUNCTION_INVOCATION_FAILED. Jaga agar file itu tidak muncul kembali.
  for (const forbidden of ['server.js', 'server.mjs', 'server.ts', 'src/server.js', 'src/server.ts']) {
    assert.ok(!fs.existsSync(path.join(root, forbidden)), forbidden + ' must not exist at the project root');
  }
  assert.ok(fs.existsSync(path.join(root, 'api/weather.js')));
  assert.ok(fs.existsSync(path.join(root, 'api/health.js')));
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.equal(vercelConfig.framework, null, 'framework must be pinned to null ("Other") in vercel.json');
  // .vercelignore must never exclude lib/ (needed by the api functions).
  const vercelIgnore = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8');
  assert.ok(!/^lib\b/m.test(vercelIgnore), '.vercelignore must not exclude lib/');
});

test('OpenWeather AQI mapping uses the documented 1-5 scale', () => {
  assert.equal(aqiCategory(1).label, 'Baik');
  assert.equal(aqiCategory(2).label, 'Cukup');
  assert.equal(aqiCategory(3).label, 'Sedang');
  assert.equal(aqiCategory(4).label, 'Buruk');
  assert.equal(aqiCategory(5).label, 'Sangat Buruk');
  assert.equal(aqiCategory(null).label, 'Tidak tersedia');
});

test('Air Pollution API payload normalizes to the UI shape with pollutant concentrations', () => {
  const payload = {
    list: [{
      main: { aqi: 4 },
      components: { pm2_5: 88.42, pm10: 120.1, no2: 40.2, o3: 55.3, so2: 12.7, co: 900.5 },
      dt: 1770000000
    }]
  };
  const air = normalizeAirQuality(payload);
  assert.equal(air.scale, 'OpenWeather AQI');
  assert.equal(air.index, 4);
  assert.equal(air.category, 'Buruk');
  assert.equal(air.pollutants.length, 6);
  assert.deepEqual(Array.from(air.pollutants, p => p.name), ['PM2.5', 'PM10', 'NO₂', 'O₃', 'SO₂', 'CO']);
  assert.ok(air.pollutants.every(p => p.unit === 'µg/m³' && typeof p.value === 'number'));
  assert.equal(air.pollutants[0].value, 88.42);
});

test('One Call daily records convert imperial temperatures and precipitation probability', () => {
  const records = [
    { dt: 1770000000, temp: { min: 70, max: 89 }, pop: 0.25, humidity: 80, wind_speed: 10, uvi: 8, weather: [{ description: 'cerah', icon: '01d' }] },
    { dt: 1770086400, temp: { min: 71, max: 88 }, pop: 0, humidity: 70, wind_speed: 8, uvi: 9, weather: [{ description: 'berawan', icon: '02d' }] }
  ];
  const days = normalizeDailyRecords(records, '2026-02-02');
  assert.equal(days.length, 2);
  assert.equal(days[0].high, 89);
  assert.equal(days[0].low, 70);
  assert.equal(days[0].rainChance, 25);
  assert.equal(days[0].wind, 16);
  assert.equal(days[0].icon, '01d');
});

test('5-day/3-hour fallback groups records into days with min/max temperatures', () => {
  const forecast = {
    list: [
      { dt: Math.floor(Date.UTC(2026, 1, 2, 0, 0, 0) / 1000), main: { temp: 72, humidity: 70 }, pop: 0.1, wind: { speed: 5 }, weather: [{ description: 'cerah', icon: '01d' }] },
      { dt: Math.floor(Date.UTC(2026, 1, 2, 12, 0, 0) / 1000), main: { temp: 86, humidity: 60 }, pop: 0.4, wind: { speed: 7 }, weather: [{ description: 'berawan', icon: '02d' }] },
      { dt: Math.floor(Date.UTC(2026, 1, 3, 12, 0, 0) / 1000), main: { temp: 84, humidity: 65 }, pop: 0, wind: { speed: 6 }, weather: [{ description: 'hujan', icon: '10d' }] }
    ]
  };
  const days = normalizeBasicDailyRecords(forecast, '2026-02-02');
  assert.equal(days.length, 2);
  assert.equal(days[0].high, 86);
  assert.equal(days[0].low, 72);
  assert.equal(days[0].rainChance, 40);
  assert.equal(days[0].today, true);
  assert.equal(days[1].today, false);
});

test('hourly normalization separates today and tomorrow with null-safe fields', () => {
  const now = Math.floor(Date.now() / 1000);
  const tomorrow = now + 24 * 3600;
  const payload = {
    data: [
      { dt: now, temp: 77, humidity: 80, pop: 0.2, wind_speed: 6, weather: [{ description: 'cerah', icon: '01d' }] },
      { dt: tomorrow, temp: 75, humidity: 85, pop: null, wind_speed: null, weather: [{ description: 'berawan', icon: '02d' }] }
    ]
  };
  const hourly = normalizeHourlyRecords(payload.data);
  assert.ok(hourly.today.length >= 1);
  assert.ok(hourly.tomorrow.length >= 1);
  assert.equal(hourly.today[0].rain, 20);
  assert.equal(hourly.tomorrow[0].rain, null);
  assert.equal(hourly.tomorrow[0].wind, null);
});

test('minute timeline normalization clamps probability into 0-100', () => {
  const payload = {
    data: [
      { dt: 1770000000, pop: 0 },
      { dt: 1770000060, pop: 0.55 },
      { dt: 1770000120, pop: 1.2 }
    ]
  };
  const minute = normalizeMinuteCast(payload);
  assert.equal(minute.intervalMinutes, 1);
  assert.deepEqual(minute.precipitationProbability, [0, 55, 100]);
});

test('GET /api/health reports configuration without leaking the key', async (t) => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const response = await fetch('http://127.0.0.1:' + port + '/api/health');
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.provider, 'OpenWeather');
  assert.equal(typeof body.configured, 'boolean');
  assert.equal(body.location.name, 'Klumprit, Jawa Tengah');
  assert.ok(!JSON.stringify(body).includes('appid'));
  assert.doesNotMatch(JSON.stringify(body), /\b[0-9a-f]{32}\b/);
});

test('GET /api/weather explains the full provider chain when nothing can be reached', async (t) => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const response = await fetch('http://127.0.0.1:' + port + '/api/weather');
  const body = await response.json();

  // Tanpa key dan tanpa Open-Meteo yang dapat dijangkau: error harus jelas, bukan payload karangan.
  assert.equal(response.status, 502);
  assert.equal(body.error.code, 'WEATHER_PROVIDERS_UNAVAILABLE');
  assert.deepEqual(body.providerChain, ['OpenWeather', 'Open-Meteo']);
  const codes = body.attempts.map(attempt => attempt.code);
  assert.ok(codes.includes('OPENWEATHER_API_KEY_NOT_CONFIGURED'));
  assert.ok(codes.includes('OPEN_METEO_UNAVAILABLE'));
  assert.ok(!JSON.stringify(body).includes('appid'));
  assert.doesNotMatch(JSON.stringify(body), /\b[0-9a-f]{32}\b/);
});

test('static server only exposes public project files', async (t) => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const index = await fetch('http://127.0.0.1:' + port + '/');
  assert.equal(index.status, 200);
  const traversal = await fetch('http://127.0.0.1:' + port + '/../.env');
  assert.equal(traversal.status, 404);
  const appJs = await fetch('http://127.0.0.1:' + port + '/js/app.js');
  assert.equal(appJs.status, 200);
  const body = await appJs.text();
  assert.doesNotMatch(body, /\b[0-9a-f]{32}\b/);
});
