'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const sekitarkuData = require(path.join(root, 'js/sekitarku-data.js'));
const { getSekitarkuBundle, getWidgetPayload } = require(path.join(root, 'lib/sekitarku.js'));
const { resolveLocationContext } = require(path.join(root, 'lib/openweather.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sekitarkuJs = fs.readFileSync(path.join(root, 'js/sekitarku.js'), 'utf8');

test('National database includes 500+ Indonesian cities across 38 provinces plus Klumprit', () => {
  assert.ok(sekitarkuData.INDONESIA_CITIES.length >= 515, 'expected at least 515 cities');
  const klumprit = sekitarkuData.findCityByName('Klumprit');
  assert.ok(klumprit);
  assert.equal(klumprit.province, 'Jawa Tengah');

  const jakarta = sekitarkuData.findCityByName('Jakarta Pusat');
  assert.ok(jakarta);
  const ikn = sekitarkuData.findCityByName('Nusantara');
  assert.ok(ikn);

  const nearestToMonas = sekitarkuData.findNearestCity(-6.175, 106.827);
  assert.ok(nearestToMonas.name.includes('Jakarta'));
  assert.ok(nearestToMonas.distanceKm < 10);
});

test('Eco-Health composite score (0-100), outdoor activity readiness matrix, and Berkeley Earth cigarette conversion work accurately', () => {
  // Clean air: AQI 30, 26 C, 65% humidity, UV 2, PM2.5 11 ug/m3 -> 0.5 cigs/day
  const healthy = sekitarkuData.calculateEcoHealthScore(30, 26, 65, 2, 11);
  assert.ok(healthy.score >= 80 && healthy.score <= 100);
  assert.equal(healthy.category, 'Sangat Sehat & Optimal');
  assert.equal(healthy.cigs, 0.5);
  assert.equal(healthy.cigarettesEquivalent, 0.5);
  assert.equal(healthy.activities.jogging.status, 'Ideal');
  assert.equal(healthy.activities.cycling.status, 'Ideal');
  assert.equal(healthy.activities.kidsAndSeniors.status, 'Aman');
  assert.equal(healthy.activities.ventilation.status, 'Buka Jendela');

  // Polluted air: AQI 180, 34 C, 85% humidity, UV 9, PM2.5 88 ug/m3 -> 4.0 cigs/day
  const polluted = sekitarkuData.calculateEcoHealthScore(180, 34, 85, 9, 88);
  assert.ok(polluted.score < 40);
  assert.equal(polluted.category, 'Berbahaya Bagi Kesehatan');
  assert.equal(polluted.cigs, 4);
  assert.equal(polluted.activities.jogging.status, 'Hindari');
  assert.equal(polluted.activities.kidsAndSeniors.status, 'Di Dalam Ruangan');
  assert.equal(polluted.activities.ventilation.status, 'Tutup Jendela');
});

test('PVMBG / MAGMA volcano proximity detects nearest active volcano and status level I-IV', () => {
  assert.ok(sekitarkuData.INDONESIA_VOLCANOES.length >= 25);
  // Klumprit (-7.42, 109.24) is closest to Gunung Slamet (-7.242, 109.208)
  const fromKlumprit = sekitarkuData.getNearbyVolcanoes(-7.42, 109.24);
  assert.ok(fromKlumprit.nearest);
  assert.equal(fromKlumprit.nearest.name, 'Gunung Slamet');
  assert.ok(fromKlumprit.nearest.distanceKm > 15 && fromKlumprit.nearest.distanceKm < 30);
  assert.equal(fromKlumprit.nearest.status.code, 'LEVEL II');

  // Yogyakarta (-7.7956, 110.3695) is closest to Gunung Merapi (Level III Siaga)
  const fromYogya = sekitarkuData.getNearbyVolcanoes(-7.7956, 110.3695);
  assert.equal(fromYogya.nearest.name, 'Gunung Merapi');
  assert.equal(fromYogya.nearest.status.code, 'LEVEL III');
});

test('FDRS Karhutla rating, satellite hotspots, and haze cross-correlation work across Indonesia', () => {
  assert.ok(sekitarkuData.SATELLITE_HOTSPOTS.length >= 100);
  const fdrsLow = sekitarkuData.calculateFdrs({ current: { temp: 26, humidity: 85, windSpeed: 8, precipitation: 6 } });
  assert.equal(fdrsLow.code, 'AMAN');
  const fdrsExtreme = sekitarkuData.calculateFdrs({ current: { temp: 36, humidity: 40, windSpeed: 22, precipitation: 0 } });
  assert.equal(fdrsExtreme.code, 'EKSTREM');

  const hotspots = sekitarkuData.getNearbyHotspots(1.48, 101.99);
  assert.ok(hotspots.nearest);
  assert.ok(hotspots.nearest.distanceKm < 5);
  const haze = sekitarkuData.getHazeStatus(hotspots.nearest, 120, 45);
  assert.equal(haze.isHazeActive, true);
});

test('WMO weather code virga calibration and OpenWeather location resolver work properly', () => {
  // Light drizzle code 51 with 0.05mm precip & 80% clouds -> calibrated to 3 (Berawan Tebal)
  assert.equal(sekitarkuData.calibrateWeatherCode({ weatherCode: 51, precipitation: 0.05, cloudCover: 80 }), 3);
  assert.equal(sekitarkuData.getWmoWeatherVisual(95, 1).label, 'Hujan Petir');

  // Default location remains Klumprit, Jawa Tengah
  const defaultLoc = resolveLocationContext();
  assert.equal(defaultLoc.name, 'Klumprit');
  assert.equal(defaultLoc.region, 'Jawa Tengah');

  // Custom city resolves properly
  const customLoc = resolveLocationContext({ city: 'Surabaya' });
  assert.equal(customLoc.name, 'Surabaya');
  assert.equal(customLoc.region, 'Jawa Timur');
});

test('PWA manifest, service worker, 9:16 Story Share modal, and Sekitarku cards exist in UI', () => {
  assert.ok(fs.existsSync(path.join(root, 'manifest.webmanifest')));
  assert.ok(fs.existsSync(path.join(root, 'sw.js')));
  assert.ok(fs.existsSync(path.join(root, 'leaf.svg')));
  assert.ok(fs.existsSync(path.join(root, 'widget.json')));

  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');

  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /id="eco-health-card"/);
  assert.match(html, /id="eco-cigs-value"/);
  assert.match(html, /id="sekitarku-aqi-card"/);
  assert.match(html, /id="sekitarku-quake-card"/);
  assert.match(html, /id="sekitarku-volcano-card"/);
  assert.match(html, /id="sekitarku-karhutla-card"/);
  assert.match(html, /id="city-search-modal"/);
  assert.match(html, /id="share-card-modal"/);
  assert.match(html, /id="share-story-canvas"/);
  assert.match(sekitarkuJs, /generateStoryCanvasDataUrl/);
  assert.match(sekitarkuJs, /serviceWorker\.register/);
});

test('api/sekitarku.js and api/widget.js return live BMKG + Open-Meteo data when upstream responds', async (t) => {
  const mockUpstream = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    res.writeHead(200, { 'content-type': 'application/json' });
    if (u.pathname === '/v1/forecast') {
      return res.end(JSON.stringify({
        current: {
          temperature_2m: 30.2,
          apparent_temperature: 33.1,
          relative_humidity_2m: 72,
          precipitation: 0,
          cloud_cover: 45,
          is_day: 1,
          weather_code: 2,
          wind_speed_10m: 14,
          wind_direction_10m: 90,
          uv_index: 6.4,
          surface_pressure: 1009
        },
        hourly: {
          time: ['2026-10-14T12:00', '2026-10-14T13:00'],
          temperature_2m: [30, 31],
          relative_humidity_2m: [72, 70],
          precipitation_probability: [15, 20],
          precipitation: [0, 0],
          weather_code: [2, 2],
          uv_index: [6, 5],
          cloud_cover: [45, 50],
          wind_speed_10m: [14, 15]
        },
        daily: {
          time: ['2026-10-14', '2026-10-15'],
          weather_code: [2, 1],
          temperature_2m_max: [32, 33],
          temperature_2m_min: [24, 24],
          uv_index_max: [7, 8],
          precipitation_sum: [0, 0],
          precipitation_probability_max: [20, 15],
          wind_speed_10m_max: [15, 14]
        }
      }));
    }
    if (u.pathname === '/v1/air-quality') {
      return res.end(JSON.stringify({
        current: {
          us_aqi: 66,
          pm2_5: 22.0,
          pm10: 38.5,
          carbon_monoxide: 310,
          nitrogen_dioxide: 11.2,
          sulphur_dioxide: 5.1,
          ozone: 29.0,
          dust: 9.0
        }
      }));
    }
    if (u.pathname === '/DataMKG/TEWS/autogempa.json') {
      return res.end(JSON.stringify({
        Infogempa: {
          gempa: {
            Tanggal: '14 Okt 2026',
            Jam: '10:20:30 WIB',
            Coordinates: '-7.95,110.45',
            Magnitude: '4.7',
            Kedalaman: '12 km',
            Wilayah: 'Pusat gempa berada di darat 15 km Selatan Bantul',
            Potensi: 'Tidak berpotensi tsunami',
            Dirasakan: 'III Bantul',
            Shakemap: '20261014102030.mmi.jpg'
          }
        }
      }));
    }
    if (u.pathname === '/DataMKG/TEWS/gempaterkini.json') {
      return res.end(JSON.stringify({
        Infogempa: {
          gempa: [
            {
              Tanggal: '14 Okt 2026',
              Jam: '10:20:30 WIB',
              Coordinates: '-7.95,110.45',
              Magnitude: '5.1',
              Kedalaman: '12 km',
              Wilayah: '15 km Selatan Bantul',
              Potensi: 'Tidak berpotensi tsunami'
            }
          ]
        }
      }));
    }
    res.end('{}');
  });

  await new Promise(resolve => mockUpstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => mockUpstream.close(resolve)));
  const mockPort = mockUpstream.address().port;
  const mockBase = 'http://127.0.0.1:' + mockPort;

  const child = spawn(process.execPath, ['tests/helpers/vercel-function-harness.js'], {
    cwd: root,
    env: {
      ...process.env,
      OPEN_METEO_WEATHER_BASE: mockBase,
      OPEN_METEO_AQI_BASE: mockBase,
      BMKG_API_BASE: mockBase
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => new Promise(resolve => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 2000);
  }));

  const harnessPort = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', chunk => {
      out += chunk.toString();
      const m = out.match(/harness listening on 127\.0\.0\.1:(\d+)/);
      if (m) resolve(Number(m[1]));
    });
    child.on('exit', c => reject(new Error('Early exit ' + c)));
  });

  const res = await fetch('http://127.0.0.1:' + harnessPort + '/api/sekitarku?city=Yogyakarta');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.meta.live, true);
  assert.equal(body.location.name, 'Yogyakarta');
  assert.equal(body.weather.current.temp, 30);
  assert.equal(body.airQuality.current.aqi, 66);
  assert.equal(body.airQuality.current.pm25, 22);
  // 22 ug/m3 PM2.5 = 1.0 passive cigarette/day
  assert.equal(body.ecoHealth.cigs, 1);
  assert.equal(body.earthquake.latest.magnitude, 4.7);
  assert.equal(body.volcano.nearest.name, 'Gunung Merapi');

  const widgetRes = await fetch('http://127.0.0.1:' + harnessPort + '/api/widget?city=Yogyakarta');
  assert.equal(widgetRes.status, 200);
  const widgetBody = await widgetRes.json();
  assert.equal(widgetBody.city, 'Yogyakarta');
  assert.equal(widgetBody.cigarettesEquivalent, 1);
});
