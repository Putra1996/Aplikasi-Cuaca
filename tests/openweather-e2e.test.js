'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');

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
        lat: -7.42, lon: 109.24, timezone: 'Asia/Jakarta', timezone_offset: 25200,
        data: Array.from({ length: 10 }, (_, i) => ({ dt: nowBase + i * 60, precipitation: 0, pop: i >= 4 && i <= 6 ? 0.42 : 0.02 }))
      });
    }
    if (url.pathname === '/data/4.0/onecall/timeline/1h') {
      return respond({
        lat: -7.42, lon: 109.24, timezone: 'Asia/Jakarta', timezone_offset: 25200,
        data: Array.from({ length: 8 }, (_, i) => ({ dt: nowBase + i * 3600, temp: 76 + i, feels_like: 80, pressure: 1010, humidity: 80, dew_point: 70, uvi: 2, clouds: 50, visibility: 10000, wind_speed: 6, wind_deg: 180, pop: 0.1 * i, weather: [{ id: 500, main: 'Rain', description: 'hujan ringan', icon: '10d' }] }))
      });
    }
    if (url.pathname === '/data/4.0/onecall/timeline/1day') {
      return respond({
        lat: -7.42, lon: 109.24, timezone: 'Asia/Jakarta', timezone_offset: 25200,
        data: Array.from({ length: 10 }, (_, i) => ({
          dt: nowBase + i * 86400, sunrise: nowBase - 20000 + i * 86400, sunset: nowBase + 15000 + i * 86400,
          temp: { day: 86 + i, min: 72, max: 89, night: 76, eve: 82, morn: 73 },
          feels_like: { day: 90, night: 78, eve: 84, morn: 75 },
          pressure: 1010, humidity: 78, dew_point: 70, wind_speed: 7, wind_deg: 200,
          weather: [{ id: 500, main: 'Rain', description: 'hujan ringan', icon: '10d' }],
          clouds: 60, pop: 0.35, uvi: 9.5
        }))
      });
    }
    if (url.pathname === '/data/2.5/air_pollution') {
      return respond({
        list: [{ main: { aqi: 3 }, components: { co: 500, no2: 20, o3: 40, so2: 8, pm2_5: 55, pm10: 90, nh3: 1 }, dt: nowBase }]
      });
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end('{"cod":"404"}');
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function spawnCuacaKu(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/dev-server.js'], {
      cwd: root,
      env: {
        ...process.env,
        OPENWEATHER_API_KEY: 'e2e-test-key',
        OPENWEATHER_API_BASE: 'http://127.0.0.1:' + port,
        OPENWEATHER_LAT: '-7.42',
        OPENWEATHER_LON: '109.24',
        OPENWEATHER_REFRESH_SECONDS: '600',
        HOST: '127.0.0.1',
        PORT: '0'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('server did not start: ' + output));
    }, 8000);
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/listening on 127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve({ child, port: Number(match[1]) });
      }
    });
    child.on('exit', code => {
      clearTimeout(timer);
      reject(new Error('server exited early (' + code + '): ' + output));
    });
  });
}

test('end-to-end: proxy turns mock One Call 4.0 + Air Pollution data into a live UI payload', async (t) => {
  const mock = await startMockOpenWeather();
  t.after(() => new Promise(resolve => mock.close(resolve)));
  const { child, port } = await spawnCuacaKu(mock.address().port);
  t.after(() => new Promise(resolve => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
  }));

  const response = await fetch('http://127.0.0.1:' + port + '/api/weather');
  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.meta.live, true);
  assert.equal(payload.meta.source, 'OpenWeather API');
  assert.match(payload.meta.snapshotLabel, /WIB/);
  assert.equal(payload.provider.name, 'OpenWeather');
  assert.equal(payload.provider.modules.current.product, 'One Call API 4.0');
  assert.equal(payload.provider.modules.minuteCast.live, true);
  assert.equal(payload.provider.modules.airQuality.live, true);
  assert.equal(payload.provider.modules.monthly.live, false);

  assert.equal(payload.current.temp, 77);
  assert.equal(payload.current.condition, 'berkabut');
  assert.equal(payload.current.uvIndex, 3.2);
  assert.equal(payload.current.wind.speed, 13);
  assert.equal(payload.current.wind.direction, 'S');

  assert.equal(payload.dailyForecast.length, 10);
  assert.equal(payload.dailyForecast[0].high, 89);
  assert.equal(payload.dailyForecast[0].rainChance, 35);
  assert.equal(payload.dailyForecast[0].uvIndex, 9.5);
  assert.ok(payload.dailyForecast[0].dayFull);

  assert.equal(payload.minuteCast.intervalMinutes, 1);
  assert.equal(payload.minuteCast.precipitationProbability[4], 42);
  assert.equal(payload.hourlyForecast.today.length + payload.hourlyForecast.tomorrow.length, 8);

  assert.equal(payload.airQuality.scale, 'OpenWeather AQI');
  assert.equal(payload.airQuality.index, 3);
  assert.equal(payload.airQuality.category, 'Sedang');
  assert.equal(payload.airQuality.pollutants[0].name, 'PM2.5');
  assert.equal(payload.airQuality.pollutants[0].value, 55);

  const htmlResponse = await fetch('http://127.0.0.1:' + port + '/');
  assert.equal(htmlResponse.status, 200);
  const health = await fetch('http://127.0.0.1:' + port + '/api/health');
  const healthBody = await health.json();
  assert.equal(healthBody.configured, true);
  assert.equal(healthBody.oneCallEnabled, true);
  assert.ok(!JSON.stringify(payload).includes('e2e-test-key'));
});

test('end-to-end: provider product gaps degrade with explicit module errors instead of fabricated data', async (t) => {
  const mock = await startMockOpenWeather();
  t.after(() => new Promise(resolve => mock.close(resolve)));
  // Simulate a key without One Call access: every /data/4.0/ request is rejected.
  mock.removeAllListeners('request');
  mock.on('request', (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const nowBase = Math.floor(Date.now() / 1000);
    const respond = body => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    if (url.pathname.startsWith('/data/4.0/')) {
      response.writeHead(401, { 'content-type': 'application/json' });
      return response.end('{"cod":401,"message":"Please note that One Call API 3.0 and 4.0 require a separate subscription"}');
    }
    if (url.pathname === '/data/2.5/weather') {
      return respond({ dt: nowBase, main: { temp: 77, feels_like: 81, humidity: 88 }, weather: [{ id: 500, main: 'Rain', description: 'hujan ringan', icon: '10d' }], wind: { speed: 8, deg: 200 }, visibility: 9000, sys: { sunrise: nowBase - 20000, sunset: nowBase + 15000 }, name: 'Klumprit' });
    }
    if (url.pathname === '/data/2.5/forecast') {
      return respond({
        list: [
          { dt: nowBase + 3600, main: { temp: 76, humidity: 80 }, pop: 0.2, wind: { speed: 6 }, weather: [{ description: 'berawan', icon: '02d' }] },
          { dt: nowBase + 14400, main: { temp: 84, humidity: 75 }, pop: 0.5, wind: { speed: 7 }, weather: [{ description: 'hujan ringan', icon: '10d' }] }
        ]
      });
    }
    if (url.pathname === '/data/2.5/air_pollution') {
      response.writeHead(503, { 'content-type': 'application/json' });
      return response.end('{"cod":503}');
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end('{"cod":"404"}');
  });

  const { child, port } = await spawnCuacaKu(mock.address().port);
  t.after(() => new Promise(resolve => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
  }));

  const response = await fetch('http://127.0.0.1:' + port + '/api/weather');
  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.meta.live, true, 'basic endpoints still provide live weather');
  assert.equal(payload.provider.modules.current.product, 'Current Weather Data API');
  assert.equal(payload.provider.modules.dailyForecast.product, '5-day / 3-hour Forecast API (maks. 5 hari)');
  assert.equal(payload.provider.modules.hourlyForecast.intervalMinutes, 180);
  assert.equal(payload.provider.modules.minuteCast.live, false);
  assert.equal(payload.provider.modules.airQuality.live, false);
  assert.ok(payload.provider.modules.airQuality.error, 'air-quality gap is reported, not hidden');
  assert.equal(payload.current.temp, 77);
  assert.equal(payload.minuteCast.precipitationProbability.length, 0, 'minute forecast must not be fabricated');
  assert.equal(payload.airQuality.index, null);
});
