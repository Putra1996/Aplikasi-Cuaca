'use strict';

// Mock Open-Meteo (Forecast API + Air Quality API) untuk menguji jalur cadangan live
// di lib/openweather.js tanpa memanggil jaringan publik.
// Dipakai lewat env OPEN_METEO_WEATHER_BASE / OPEN_METEO_AQI_BASE.

const http = require('node:http');

function pad(value) {
  return String(value).padStart(2, '0');
}

function buildForecastFixture() {
  const today = new Date();
  const dayStamps = [];
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const date = new Date(today.getTime() + dayOffset * 86400000);
    dayStamps.push(`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`);
  }
  const hourStamps = [];
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0));
  for (let hour = 0; hour < 72; hour += 1) {
    const stamp = new Date(start.getTime() + hour * 3600000);
    hourStamps.push(`${stamp.getUTCFullYear()}-${pad(stamp.getUTCMonth() + 1)}-${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}:00`);
  }
  return {
    latitude: -7.42,
    longitude: 109.24,
    timezone: 'Asia/Jakarta',
    current: {
      time: hourStamps[11],
      temperature_2m: 30.4,
      relative_humidity_2m: 70,
      apparent_temperature: 34.2,
      precipitation: 0,
      weather_code: 1,
      surface_pressure: 1008,
      wind_speed_10m: 9.4,
      wind_direction_10m: 145,
      wind_gusts_10m: 21.3,
      uv_index: 7.6,
      cloud_cover: 22,
      is_day: 1
    },
    hourly: {
      time: hourStamps,
      temperature_2m: hourStamps.map((_, index) => Math.round((26 + Math.sin(index / 4) * 4) * 10) / 10),
      relative_humidity_2m: hourStamps.map(() => 72),
      precipitation_probability: hourStamps.map((_, index) => (index >= 14 && index <= 18 ? 35 : 10)),
      precipitation: hourStamps.map(() => 0),
      weather_code: hourStamps.map(() => 1),
      uv_index: hourStamps.map((_, index) => (index >= 6 && index <= 17 ? 7.5 : 0)),
      cloud_cover: hourStamps.map(() => 22),
      wind_speed_10m: hourStamps.map(() => 9.4),
      wind_gusts_10m: hourStamps.map(() => 21.3),
      visibility: hourStamps.map(() => 12000)
    },
    daily: {
      time: dayStamps,
      weather_code: dayStamps.map(() => 2),
      temperature_2m_max: dayStamps.map(() => 31.2),
      temperature_2m_min: dayStamps.map(() => 24.1),
      uv_index_max: dayStamps.map(() => 8.5),
      precipitation_sum: dayStamps.map(() => 0.4),
      precipitation_probability_max: dayStamps.map(() => 45),
      wind_speed_10m_max: dayStamps.map(() => 14.2),
      sunrise: dayStamps.map(stamp => `${stamp}T05:31`),
      sunset: dayStamps.map(stamp => `${stamp}T17:44`)
    }
  };
}

function buildAirQualityFixture() {
  const now = new Date();
  const times = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const stamp = new Date(now.getTime() + hour * 3600000);
    times.push(`${stamp.getUTCFullYear()}-${pad(stamp.getUTCMonth() + 1)}-${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}:00`);
  }
  return {
    latitude: -7.42,
    longitude: 109.24,
    timezone: 'Asia/Jakarta',
    current: {
      time: times[0],
      us_aqi: 62,
      pm2_5: 17.4,
      pm10: 28.2,
      carbon_monoxide: 240,
      nitrogen_dioxide: 9.5,
      sulphur_dioxide: 4,
      ozone: 22,
      dust: 7
    },
    hourly: {
      time: times,
      us_aqi: times.map(() => 62),
      pm2_5: times.map(() => 17.4),
      pm10: times.map(() => 28.2),
      carbon_monoxide: times.map(() => 240),
      ozone: times.map(() => 22)
    }
  };
}

function startMockOpenMeteo() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const respond = body => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    if (url.pathname === '/v1/forecast') return respond(buildForecastFixture());
    if (url.pathname === '/v1/air-quality') return respond(buildAirQualityFixture());
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end('{"reason":"not found"}');
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Port yang dijamin tidak ada pendengarnya: dipakai untuk mensimulasikan provider yang tidak
// dapat dijangkau (persis kondisi produksi 13–14 Okt 2026: OPENWEATHER_UNREACHABLE).
function reserveClosedPort() {
  return new Promise((resolve, reject) => {
    const probe = http.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

module.exports = { startMockOpenMeteo, reserveClosedPort, buildForecastFixture, buildAirQualityFixture };
