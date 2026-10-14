'use strict';

// Audit 14 Okt 2026 — regresi jalur cadangan live:
// 1) OpenWeather tidak dapat dijangkau (kondisi produksi) → /api/weather tetap live via Open-Meteo.
// 2) Semua penyedia gagal → error jelas WEATHER_PROVIDERS_UNAVAILABLE, bukan angka contoh yang diklaim live.
// 3) Klien hanya menyebut penyedia yang benar dan tidak lagi mempromosikan data contoh sebagai live.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');

const { startMockOpenMeteo, reserveClosedPort } = require('./helpers/openmeteo-mock.js');

const root = path.resolve(__dirname, '..');

function spawnCuacaKu(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/dev-server.js'], {
      cwd: root,
      env: {
        ...process.env,
        OPENWEATHER_LAT: '-7.42',
        OPENWEATHER_LON: '109.24',
        OPENWEATHER_REFRESH_SECONDS: '600',
        HOST: '127.0.0.1',
        PORT: '0',
        ...env
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

function stopChild(child) {
  return new Promise(resolve => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
  });
}

test('OpenWeather yang tidak dapat dijangkau beralih ke payload live Open-Meteo yang ditandai jelas', async (t) => {
  const mock = await startMockOpenMeteo();
  t.after(() => new Promise(resolve => mock.close(resolve)));
  const closedPort = await reserveClosedPort();

  const { child, port } = await spawnCuacaKu({
    OPENWEATHER_API_KEY: 'fallback-test-key',
    OPENWEATHER_API_BASE: 'http://127.0.0.1:' + closedPort,
    OPEN_METEO_WEATHER_BASE: 'http://127.0.0.1:' + mock.address().port,
    OPEN_METEO_AQI_BASE: 'http://127.0.0.1:' + mock.address().port,
    BMKG_API_BASE: 'http://127.0.0.1:' + mock.address().port
  });
  t.after(() => stopChild(child));

  const response = await fetch('http://127.0.0.1:' + port + '/api/weather');
  assert.equal(response.status, 200, 'dashboard harus tetap live walau OpenWeather mati');
  const payload = await response.json();

  assert.equal(payload.meta.live, true);
  assert.equal(payload.meta.source, 'Open-Meteo');
  assert.equal(payload.meta.providerName, 'Open-Meteo');
  assert.equal(payload.provider.name, 'Open-Meteo');
  assert.equal(payload.meta.fallback.from, 'OpenWeather');
  assert.equal(payload.meta.fallback.provider, 'Open-Meteo');
  assert.ok(payload.meta.fallback.attempts.length >= 1, 'penyebab kegagalan OpenWeather harus terekam');
  assert.match(payload.meta.fallback.attempts[0].provider, /OpenWeather/);
  assert.equal(payload.meta.fallback.attempts[0].code, 'OPENWEATHER_UNREACHABLE');

  // Kontrak satuan internal tetap Fahrenheit (UI memformat ke Celsius), jadi nilai ini = 30,4 °C.
  assert.equal(payload.current.temp, 86);
  assert.equal(payload.current.humidity, 70);
  assert.equal(payload.current.uvIndex, 7.6);
  // Audit: sunrise/sunset/gust/jarak pandang tidak lagi dikarang — diambil dari respons API.
  assert.equal(payload.current.sunrise, '05:31');
  assert.equal(payload.current.sunset, '17:44');
  assert.equal(payload.current.wind.gust, 21);
  assert.equal(payload.current.visibility, 12);
  assert.equal(payload.dailyForecast.length, 7);
  assert.equal(payload.hourlyForecast.today.length, 24);

  assert.equal(payload.airQuality.scale, 'US-EPA AQI (Open-Meteo)');
  assert.equal(payload.airQuality.index, 62);
  assert.equal(payload.provider.modules.minuteCast.live, false, 'MinuteCast tetap ditandai simulasi');
  assert.equal(payload.provider.modules.radar.live, false);
  assert.equal(payload.provider.modules.current.live, true);

  // Satu sumber kebenaran untuk AQI: kartu utama harus sama dengan panel Sekitarku.
  const sekitarku = await fetch('http://127.0.0.1:' + port + '/api/sekitarku?lat=-7.42&lon=109.24').then(res => res.json());
  assert.equal(sekitarku.meta.live, true);
  assert.equal(sekitarku.airQuality.current.aqi, payload.airQuality.index);

  const health = await fetch('http://127.0.0.1:' + port + '/api/health').then(res => res.json());
  assert.equal(health.providers.primary.name, 'OpenWeather');
  assert.equal(health.providers.fallback.name, 'Open-Meteo');
  assert.equal(health.providers.fallback.enabled, true);
  assert.equal(health.lastFetch.provider, 'Open-Meteo');
  assert.equal(health.lastFetch.fallbackUsed, true);
  assert.equal(health.lastFetch.ok, true);

  assert.ok(!JSON.stringify(payload).includes('fallback-test-key'), 'API key tidak boleh bocor saat fallback');
  assert.ok(!JSON.stringify(health).includes('fallback-test-key'));
});

test('bila semua penyedia gagal, /api/weather mengembalikan 502 dengan rincian percobaan', async (t) => {
  const closedPort = await reserveClosedPort();
  const { child, port } = await spawnCuacaKu({
    OPENWEATHER_API_KEY: 'fallback-test-key',
    OPENWEATHER_API_BASE: 'http://127.0.0.1:' + closedPort,
    OPEN_METEO_WEATHER_BASE: 'http://127.0.0.1:' + closedPort,
    OPEN_METEO_AQI_BASE: 'http://127.0.0.1:' + closedPort,
    BMKG_API_BASE: 'http://127.0.0.1:' + closedPort
  });
  t.after(() => stopChild(child));

  const response = await fetch('http://127.0.0.1:' + port + '/api/weather');
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.error.code, 'WEATHER_PROVIDERS_UNAVAILABLE');
  assert.deepEqual(body.providerChain, ['OpenWeather', 'Open-Meteo']);
  const providers = body.attempts.map(attempt => attempt.provider.split(' · ')[0]);
  assert.ok(providers.includes('OpenWeather'));
  assert.ok(providers.includes('Open-Meteo'));
  assert.ok(!JSON.stringify(body).includes('fallback-test-key'));

  const health = await fetch('http://127.0.0.1:' + port + '/api/health').then(res => res.json());
  assert.equal(health.lastFetch.ok, false);
  assert.equal(health.lastFetch.provider, null);
  assert.equal(health.lastFetch.attempts.length, 2);
});

test('UI menyebut penyedia yang benar dan tidak mempromosikan data contoh sebagai live', () => {
  const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sekitarkuSource = fs.readFileSync(path.join(root, 'js/sekitarku.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  assert.match(appSource, /function dataSourceName\(\)/);
  assert.match(appSource, /function aqiSourceName\(\)/);
  assert.match(appSource, /Live via ' \+ escapeHTML\(source\)/);
  assert.match(appSource, /state\.lastError = error && error\.detail/, 'penyebab kegagalan harus tersimpan untuk banner');
  assert.match(appSource, /id="air-data-badge"|airBadge = \$\('#air-data-badge'\)/);
  assert.ok(!/OpenWeather diperbarui/.test(appSource), 'teks banner tidak boleh selalu menyebut OpenWeather');

  assert.match(sekitarkuSource, /cuacakuCompat\.live === true/, 'hanya data Open-Meteo yang benar-benar live boleh menggantikan payload utama');
  assert.match(sekitarkuSource, /window\.WEATHER_DATA\.meta\.source = 'Open-Meteo'/);

  assert.match(html, /id="air-data-badge"/);
  assert.match(html, /<a id="data-notice-link" href="api\/health">Status sumber ↗<\/a>/);
  assert.ok(!/<code>server\.js<\/code>/.test(html), 'referensi server.js yang sudah dihapus harus bersih');
  assert.ok(!/jalankan server\.js/.test(html));
});

test('kartu AQI utama dan panel Sekitarku memakai ambang & label US-EPA yang sama', () => {
  const dataSource = fs.readFileSync(path.join(root, 'js/sekitarku-data.js'), 'utf8');
  const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sandbox = { module: { exports: {} }, console };
  sandbox.window = sandbox;
  vm.runInNewContext(dataSource, sandbox);
  const sekitarkuData = sandbox.module.exports;

  // Angka yang sama harus menghasilkan kategori yang sama di kedua kartu.
  assert.equal(sekitarkuData.getUsAqiInfo(62).label, 'Sedang');
  assert.match(appSource, /if \(value <= 50\) return \{ label: 'Baik'/);
  assert.match(appSource, /if \(value <= 100\) return \{ label: 'Sedang'/);
  assert.match(appSource, /if \(value <= 150\) return \{ label: 'Tidak Sehat \(Sensitif\)'/);
  assert.match(appSource, /if \(value <= 200\) return \{ label: 'Tidak Sehat'/);
  assert.match(appSource, /return \{ label: 'Berbahaya'/);
  assert.match(appSource, /value >= 101/, 'ambang saran aktivitas mengikuti kategori sensitif US-EPA');
});
