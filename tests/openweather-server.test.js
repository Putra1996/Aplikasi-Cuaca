'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const {
  aqiCategory,
  normalizeAirQuality,
  normalizeDailyRecords,
  normalizeBasicDailyRecords,
  normalizeHourlyRecords,
  normalizeMinuteCast,
  createServer
} = require(path.join(root, 'server.js'));

test('server keeps the OpenWeather key out of client-side code and public responses', () => {
  assert.match(serverSource, /OPENWEATHER_API_KEY/);
  assert.doesNotMatch(appSource, /appid=/);
  assert.doesNotMatch(html, /appid=/);
  // No 32-hex API-key-shaped strings may appear in browser-facing files.
  assert.doesNotMatch(appSource, /\b[0-9a-f]{32}\b/);
  assert.doesNotMatch(html, /\b[0-9a-f]{32}\b/);
  assert.match(serverSource, /Do not log\/return the request URL or provider body/);
  assert.ok(fs.existsSync(path.join(root, '.gitignore')));
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /\.env/);
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

test('GET /api/weather without a configured key returns a clean 503 provider error', async (t) => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const response = await fetch('http://127.0.0.1:' + port + '/api/weather');
  const body = await response.json();
  assert.ok(response.status === 503 || response.status === 200);
  if (response.status === 503) {
    assert.equal(body.error.code, 'OPENWEATHER_API_KEY_NOT_CONFIGURED');
    assert.ok(!JSON.stringify(body).includes('appid'));
    assert.doesNotMatch(JSON.stringify(body), /\b[0-9a-f]{32}\b/);
  }
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
