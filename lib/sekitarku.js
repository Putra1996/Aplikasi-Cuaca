'use strict';

/**
 * Layanan Server-Side Sekitarku (BMKG InaTEWS, Open-Meteo Weather & Air Quality,
 * PVMBG Gunung Api, KLHK/NASA Karhutla FDRS, Skor Lingkungan Eco-Health & Rokok Pasif).
 * Dipakai oleh fungsi serverless Vercel (api/sekitarku.js, api/widget.js) dan scripts/dev-server.js.
 */

const { URL } = require('node:url');
const sekitarkuData = require('../js/sekitarku-data.js');

const OPEN_METEO_WEATHER_BASE = process.env.OPEN_METEO_WEATHER_BASE || 'https://api.open-meteo.com';
const OPEN_METEO_AQI_BASE = process.env.OPEN_METEO_AQI_BASE || 'https://air-quality-api.open-meteo.com';
const BMKG_API_BASE = process.env.BMKG_API_BASE || 'https://data.bmkg.go.id';

const cacheStore = new Map();

function getCached(key) {
  const item = cacheStore.get(key);
  if (item && item.expiresAt > Date.now()) return item.value;
  cacheStore.delete(key);
  return null;
}

function setCached(key, value, ttlMs) {
  if (cacheStore.size > 200) {
    const firstKey = cacheStore.keys().next().value;
    if (firstKey) cacheStore.delete(firstKey);
  }
  cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

function toFahrenheit(celsius) {
  if (celsius == null || !Number.isFinite(Number(celsius))) return null;
  return Math.round(Number(celsius) * 9 / 5 + 32);
}

function compassId(degrees) {
  const value = Number(degrees);
  if (!Number.isFinite(value)) return '—';
  const labels = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
  return labels[Math.round(((value % 360) + 360) % 360 / 45) % 8];
}

function getDefaultAqi(lat, lon) {
  const now = new Date();
  const datePart = now.toISOString().split('T')[0];
  const hours = Array.from({ length: 24 }, (_, i) => `${datePart}T${String(i).padStart(2, '0')}:00`);
  // Deterministic city variation based on lat/lon
  const seed = Math.abs(Math.round((Number(lat || -6.2) * 10) + (Number(lon || 106.8) * 10))) % 35;
  const baseAqi = 38 + seed;
  const basePm25 = Math.round((8.5 + seed * 0.45) * 10) / 10;

  return {
    live: false,
    source: 'Fallback Open-Meteo & Copernicus',
    current: {
      aqi: baseAqi,
      pm25: basePm25,
      pm10: Math.round((basePm25 * 1.65) * 10) / 10,
      co: 260 + seed * 4,
      no2: Math.round((7.5 + seed * 0.25) * 10) / 10,
      so2: Math.round((3.8 + seed * 0.12) * 10) / 10,
      o3: Math.round((24.0 + seed * 0.3) * 10) / 10,
      dust: Math.round((6.0 + seed * 0.2) * 10) / 10,
      time: now.toISOString()
    },
    hourly: {
      time: hours,
      us_aqi: hours.map((_, i) => Math.max(15, baseAqi + Math.round(Math.sin(i / 3.8) * 12))),
      pm2_5: hours.map((_, i) => Math.max(4, Math.round((basePm25 + Math.sin(i / 3.8) * 4) * 10) / 10)),
      pm10: hours.map((_, i) => Math.max(8, Math.round((basePm25 * 1.6 + Math.sin(i / 3.8) * 6) * 10) / 10)),
      carbon_monoxide: hours.map((_, i) => 250 + (i % 6) * 12),
      ozone: hours.map((_, i) => 22 + (i % 8) * 2)
    }
  };
}

function getDefaultWeather(lat, lon) {
  const now = new Date();
  const datePart = now.toISOString().split('T')[0];
  const hours = Array.from({ length: 24 }, (_, i) => `${datePart}T${String(i).padStart(2, '0')}:00`);
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * 86400000).toISOString().split('T')[0]);
  const latNum = Number(lat) || -7.42;
  const baseTemp = latNum < -7 ? 28 : 30;

  return {
    live: false,
    source: 'Fallback BMKG & Open-Meteo',
    current: {
      temp: baseTemp,
      feelsLike: baseTemp + 3,
      humidity: 76,
      precipitation: 0,
      cloudCover: 48,
      isDay: 1,
      weatherCode: 2,
      windSpeed: 12,
      windDirection: 135,
      uvIndex: 5,
      pressure: 1010,
      time: now.toISOString()
    },
    hourly: {
      time: hours,
      temperature_2m: hours.map((_, i) => Math.round(baseTemp - 3 + Math.sin((i - 6) / 24 * Math.PI * 2) * 4)),
      relative_humidity_2m: hours.map((_, i) => Math.min(96, Math.max(55, Math.round(78 - Math.sin((i - 6) / 24 * Math.PI * 2) * 14)))),
      precipitation_probability: hours.map((_, i) => (i >= 14 && i <= 18 ? 35 : 10)),
      precipitation: hours.map(() => 0),
      weather_code: hours.map((_, i) => (i >= 14 && i <= 17 ? 3 : 2)),
      uv_index: hours.map((_, i) => (i >= 6 && i <= 17 ? Math.max(0, 8 - Math.abs(12 - i)) : 0)),
      cloud_cover: hours.map(() => 48),
      wind_speed_10m: hours.map((_, i) => 9 + (i % 5) * 2)
    },
    daily: {
      time: days,
      weather_code: [2, 1, 2, 3, 2, 1, 2],
      temperature_2m_max: [32, 33, 32, 31, 32, 33, 32],
      temperature_2m_min: [24, 24, 23, 23, 24, 24, 23],
      uv_index_max: [7, 8, 7, 6, 7, 8, 7],
      precipitation_sum: [0, 0, 1.2, 3.5, 0.4, 0, 0.8],
      precipitation_probability_max: [20, 15, 35, 55, 25, 15, 30],
      wind_speed_10m_max: [14, 13, 15, 16, 13, 12, 14]
    }
  };
}

function getDefaultEarthquake() {
  return {
    live: false,
    date: '14 Okt 2026',
    time: '09:15:20 WIB',
    dateTime: '14 Okt 2026 09:15:20 WIB',
    lat: -7.92,
    lon: 110.42,
    magnitude: 4.2,
    depth: '14 km',
    wilayah: 'Pusat gempa berada di darat 18 km BaratDaya Gunungkidul, D.I. Yogyakarta',
    potensi: 'Tidak berpotensi tsunami',
    dirasakan: 'II-III Bantul, II Gunungkidul',
    shakemap: null
  };
}

function getDefaultRecentEarthquakes() {
  return [
    getDefaultEarthquake(),
    {
      id: 'quake-1',
      date: '13 Okt 2026',
      time: '21:42:10 WIB',
      dateTime: '13 Okt 2026 21:42:10 WIB',
      lat: -6.84,
      lon: 107.13,
      magnitude: 3.8,
      depth: '10 km',
      wilayah: '12 km BaratDaya Kab. Cianjur, Jawa Barat',
      potensi: 'Tidak berpotensi tsunami'
    },
    {
      id: 'quake-2',
      date: '13 Okt 2026',
      time: '14:08:55 WIB',
      dateTime: '13 Okt 2026 14:08:55 WIB',
      lat: -8.65,
      lon: 115.22,
      magnitude: 4.6,
      depth: '38 km',
      wilayah: '34 km Tenggara Kuta Selatan, Bali',
      potensi: 'Tidak berpotensi tsunami'
    },
    {
      id: 'quake-3',
      date: '12 Okt 2026',
      time: '18:30:12 WIB',
      dateTime: '12 Okt 2026 18:30:12 WIB',
      lat: 1.48,
      lon: 127.62,
      magnitude: 5.1,
      depth: '82 km',
      wilayah: '29 km BaratLaut Halmahera Barat, Maluku Utara',
      potensi: 'Tidak berpotensi tsunami'
    },
    {
      id: 'quake-4',
      date: '12 Okt 2026',
      time: '06:12:44 WIB',
      dateTime: '12 Okt 2026 06:12:44 WIB',
      lat: -0.95,
      lon: 100.35,
      magnitude: 4.4,
      depth: '24 km',
      wilayah: '22 km BaratDaya Pariaman, Sumatera Barat',
      potensi: 'Tidak berpotensi tsunami'
    }
  ];
}

// Variabel wajib: bentuk respons yang sudah terbukti hidup di produksi.
const OPEN_METEO_FORECAST_REQUIRED = {
  current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,uv_index,cloud_cover,is_day',
  hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,uv_index,cloud_cover,wind_speed_10m',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max'
};
// Variabel tambahan (audit 14 Okt 2026): dipekerjakan bila API menerimanya — henti memberhentikan
// nilai sunrise/sunset/gust/visibility yang sebelumnya di-hardcode. Bila ditolak, permintaan
// diulang tanpa variabel ini sehingga data live tetap mengalir (tanpa angka karangan).
const OPEN_METEO_FORECAST_OPTIONAL = {
  current: 'wind_gusts_10m',
  hourly: 'wind_gusts_10m,visibility',
  daily: 'sunrise,sunset'
};

function joinVariables(required, optional, includeOptional) {
  return includeOptional && optional ? `${required},${optional}` : required;
}

async function requestOpenMeteoForecast(safeLat, safeLon, includeOptional) {
  const url = new URL('/v1/forecast', OPEN_METEO_WEATHER_BASE);
  url.searchParams.set('latitude', String(safeLat));
  url.searchParams.set('longitude', String(safeLon));
  url.searchParams.set('current', joinVariables(OPEN_METEO_FORECAST_REQUIRED.current, OPEN_METEO_FORECAST_OPTIONAL.current, includeOptional));
  url.searchParams.set('hourly', joinVariables(OPEN_METEO_FORECAST_REQUIRED.hourly, OPEN_METEO_FORECAST_OPTIONAL.hourly, includeOptional));
  url.searchParams.set('daily', joinVariables(OPEN_METEO_FORECAST_REQUIRED.daily, OPEN_METEO_FORECAST_OPTIONAL.daily, includeOptional));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('models', 'best_match');
  url.searchParams.set('forecast_days', '7');

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) throw new Error(`Open-Meteo weather status ${res.status}`);
  return res.json();
}

/**
 * Ambil nilai per jam yang sejajar dengan waktu observasi saat ini.
 * Open-Meteo memakai penanda waktu lokal yang sama pada blok current & hourly,
 * sehingga pencocokan string sudah cukup; bila tidak ada, dipakai indeks terdekat.
 */
function valueAtCurrentHour(hourly, key, currentTime) {
  if (!hourly || !Array.isArray(hourly[key]) || !hourly[key].length) return null;
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  let index = times.indexOf(currentTime);
  if (index < 0) {
    const targetTime = currentTime ? new Date(String(currentTime)).getTime() : Date.now();
    let bestDistance = Infinity;
    times.forEach((time, idx) => {
      const distance = Math.abs(new Date(String(time)).getTime() - targetTime);
      if (Number.isFinite(distance) && distance < bestDistance) {
        bestDistance = distance;
        index = idx;
      }
    });
  }
  const value = index >= 0 ? hourly[key][index] : null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

async function fetchOpenMeteoWeather(lat, lon, forceRefresh) {
  const safeLat = Number.isFinite(Number(lat)) ? Number(lat) : -7.42;
  const safeLon = Number.isFinite(Number(lon)) ? Number(lon) : 109.24;
  const cacheKey = `om_weather_${safeLat.toFixed(3)}_${safeLon.toFixed(3)}`;
  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  try {
    let data;
    try {
      data = await requestOpenMeteoForecast(safeLat, safeLon, true);
    } catch (optionalFailure) {
      // Lapisan opsional tidak boleh mematikan data live: ulangi dengan variabel wajib saja.
      data = await requestOpenMeteoForecast(safeLat, safeLon, false);
    }

    const rawPrecip = Number(data.current && data.current.precipitation != null ? data.current.precipitation : 0);
    const rawCloud = Number(data.current && data.current.cloud_cover != null ? data.current.cloud_cover : 50);
    const rawCode = Number(data.current && data.current.weather_code != null ? data.current.weather_code : 2);
    const resolvedCode = sekitarkuData.calibrateWeatherCode({
      weatherCode: rawCode,
      precipitation: rawPrecip,
      cloudCover: rawCloud
    });

    const calibratedHourlyCodes = ((data.hourly && data.hourly.weather_code) || []).map((code, idx) => {
      const hPrecip = Number(data.hourly && data.hourly.precipitation && data.hourly.precipitation[idx] || 0);
      const hClouds = Number(data.hourly && data.hourly.cloud_cover && data.hourly.cloud_cover[idx] || 50);
      const hProb = Number(data.hourly && data.hourly.precipitation_probability && data.hourly.precipitation_probability[idx] || 0);
      if ((hPrecip < 0.25 || hProb < 30) && ((code >= 51 && code <= 57) || code === 61 || code === 80)) {
        if (hClouds >= 75) return 3;
        if (hClouds >= 35) return 2;
        return 1;
      }
      return sekitarkuData.calibrateWeatherCode({ weatherCode: code, precipitation: hPrecip, cloudCover: hClouds });
    });

    const calibratedDailyCodes = ((data.daily && data.daily.weather_code) || []).map((code, idx) => {
      const pSum = Number(data.daily && data.daily.precipitation_sum && data.daily.precipitation_sum[idx] || 0);
      const pProb = Number(data.daily && data.daily.precipitation_probability_max && data.daily.precipitation_probability_max[idx] || 0);
      if (pSum < 0.35 && pProb < 35 && ((code >= 51 && code <= 57) || code === 80 || code === 61)) {
        return 2;
      }
      return code;
    });

    const currentTime = (data.current && data.current.time) || new Date().toISOString();
    const currentGustKmh = data.current && data.current.wind_gusts_10m != null
      ? Math.round(Number(data.current.wind_gusts_10m))
      : (() => {
        const hourlyGust = valueAtCurrentHour(data.hourly, 'wind_gusts_10m', currentTime);
        return hourlyGust == null ? null : Math.round(hourlyGust);
      })();
    const currentVisibilityKm = (() => {
      const hourlyVisibility = valueAtCurrentHour(data.hourly, 'visibility', currentTime);
      return hourlyVisibility == null ? null : Math.round(hourlyVisibility / 100) / 10;
    })();

    const formatted = {
      live: true,
      source: 'BMKG & Open-Meteo API',
      current: {
        temp: Math.round(data.current && data.current.temperature_2m != null ? data.current.temperature_2m : 29),
        feelsLike: Math.round(data.current && data.current.apparent_temperature != null ? data.current.apparent_temperature : 32),
        humidity: data.current && data.current.relative_humidity_2m != null ? data.current.relative_humidity_2m : 75,
        precipitation: rawPrecip,
        cloudCover: rawCloud,
        isDay: data.current && data.current.is_day != null ? data.current.is_day : 1,
        weatherCode: resolvedCode,
        windSpeed: Math.round(data.current && data.current.wind_speed_10m != null ? data.current.wind_speed_10m : 10),
        windDirection: data.current && data.current.wind_direction_10m != null ? data.current.wind_direction_10m : 180,
        windGust: currentGustKmh,
        visibilityKm: currentVisibilityKm,
        uvIndex: data.current && data.current.uv_index != null ? Math.round(data.current.uv_index * 10) / 10 : 4,
        pressure: Math.round(data.current && data.current.surface_pressure != null ? data.current.surface_pressure : 1010),
        time: currentTime
      },
      hourly: Object.assign({}, data.hourly || getDefaultWeather(safeLat, safeLon).hourly, {
        weather_code: calibratedHourlyCodes
      }),
      daily: Object.assign({}, data.daily || getDefaultWeather(safeLat, safeLon).daily, {
        weather_code: calibratedDailyCodes
      })
    };

    return setCached(cacheKey, formatted, 5 * 60 * 1000);
  } catch (error) {
    return getDefaultWeather(safeLat, safeLon);
  }
}

async function fetchOpenMeteoAqi(lat, lon, forceRefresh) {
  const safeLat = Number.isFinite(Number(lat)) ? Number(lat) : -7.42;
  const safeLon = Number.isFinite(Number(lon)) ? Number(lon) : 109.24;
  const cacheKey = `om_aqi_${safeLat.toFixed(3)}_${safeLon.toFixed(3)}`;
  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  try {
    const url = new URL('/v1/air-quality', OPEN_METEO_AQI_BASE);
    url.searchParams.set('latitude', String(safeLat));
    url.searchParams.set('longitude', String(safeLon));
    url.searchParams.set('current', 'us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust');
    url.searchParams.set('hourly', 'us_aqi,pm2_5,pm10,carbon_monoxide,ozone');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '3');

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`Open-Meteo AQI status ${res.status}`);
    const data = await res.json();

    const formatted = {
      live: true,
      source: 'Open-Meteo & Copernicus Atmosphere',
      current: {
        aqi: Math.round(data.current && data.current.us_aqi != null ? data.current.us_aqi : 45),
        pm25: Math.round(((data.current && data.current.pm2_5 != null ? data.current.pm2_5 : 12.5)) * 10) / 10,
        pm10: Math.round(((data.current && data.current.pm10 != null ? data.current.pm10 : 22.0)) * 10) / 10,
        co: Math.round(data.current && data.current.carbon_monoxide != null ? data.current.carbon_monoxide : 280),
        no2: Math.round(((data.current && data.current.nitrogen_dioxide != null ? data.current.nitrogen_dioxide : 8.5)) * 10) / 10,
        so2: Math.round(((data.current && data.current.sulphur_dioxide != null ? data.current.sulphur_dioxide : 4.2)) * 10) / 10,
        o3: Math.round(((data.current && data.current.ozone != null ? data.current.ozone : 25.0)) * 10) / 10,
        dust: Math.round(((data.current && data.current.dust != null ? data.current.dust : 8.0)) * 10) / 10,
        time: (data.current && data.current.time) || new Date().toISOString()
      },
      hourly: data.hourly || getDefaultAqi(safeLat, safeLon).hourly
    };

    return setCached(cacheKey, formatted, 5 * 60 * 1000);
  } catch (error) {
    return getDefaultAqi(safeLat, safeLon);
  }
}

async function fetchBmkgEarthquakes(forceRefresh) {
  const cacheKey = 'bmkg_earthquakes_bundle';
  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  let latest = null;
  let recent = [];

  try {
    const autoUrl = new URL('/DataMKG/TEWS/autogempa.json', BMKG_API_BASE);
    const recentUrl = new URL('/DataMKG/TEWS/gempaterkini.json', BMKG_API_BASE);
    const [autoRes, recentRes] = await Promise.allSettled([
      fetch(autoUrl, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) }),
      fetch(recentUrl, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) })
    ]);

    if (autoRes.status === 'fulfilled' && autoRes.value.ok) {
      const autoData = await autoRes.value.json();
      const g = autoData && autoData.Infogempa && autoData.Infogempa.gempa;
      if (g) {
        const coords = g.Coordinates ? String(g.Coordinates).split(',') : ['0', '0'];
        latest = {
          live: true,
          date: g.Tanggal || '',
          time: g.Jam || '',
          dateTime: `${g.Tanggal || ''} ${g.Jam || ''}`.trim(),
          lat: parseFloat(coords[0]) || 0,
          lon: parseFloat(coords[1]) || 0,
          magnitude: parseFloat(g.Magnitude) || 0,
          depth: g.Kedalaman || '-',
          wilayah: g.Wilayah || 'Wilayah Indonesia',
          potensi: g.Potensi || 'Tidak berpotensi tsunami',
          dirasakan: g.Dirasakan || '-',
          shakemap: g.Shakemap ? `${BMKG_API_BASE.replace(/\/$/, '')}/DataMKG/TEWS/${g.Shakemap}` : null
        };
      }
    }

    if (recentRes.status === 'fulfilled' && recentRes.value.ok) {
      const recentData = await recentRes.value.json();
      const list = (recentData && recentData.Infogempa && Array.isArray(recentData.Infogempa.gempa)) ? recentData.Infogempa.gempa : [];
      recent = list.map((g, idx) => {
        const coords = g.Coordinates ? String(g.Coordinates).split(',') : ['0', '0'];
        return {
          id: `quake-${idx}-${g.Tanggal || ''}-${g.Jam || ''}`,
          date: g.Tanggal || '',
          time: g.Jam || '',
          dateTime: `${g.Tanggal || ''} ${g.Jam || ''}`.trim(),
          lat: parseFloat(coords[0]) || 0,
          lon: parseFloat(coords[1]) || 0,
          magnitude: parseFloat(g.Magnitude) || 0,
          depth: g.Kedalaman || '-',
          wilayah: g.Wilayah || 'Indonesia',
          potensi: g.Potensi || 'Tidak berpotensi tsunami'
        };
      });
    }
  } catch (error) {
    // Fallback below
  }

  const result = {
    live: Boolean(latest && latest.live),
    latest: latest || getDefaultEarthquake(),
    recent: recent.length > 0 ? recent : getDefaultRecentEarthquakes()
  };

  return setCached(cacheKey, result, 3 * 60 * 1000);
}

/**
 * Konversi data Open-Meteo ke struktur kompatibel WEATHER_DATA CuacaKu
 * sehingga seluruh grafik, prakiraan harian/per jam, UV, dan kartu Beranda ikut ter-update.
 *
 * Audit 14 Okt 2026: fungsi ini menandai secara eksplisit apakah data sumber benar-benar live
 * (`live`, `aqiLive`) dan berhenti mengarang angka — sunrise/sunset, gust, dan jarak pandang
 * kini berasal dari API (null bila provider tidak mengirimkannya) alih-alih nilai hardcode.
 */
function openMeteoClockLabel(isoValue) {
  const text = String(isoValue == null ? '' : isoValue);
  const match = text.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

function buildCuacaKuCompatibleWeather(location, weatherData, aqiData) {
  const cur = weatherData.current || {};
  const visual = sekitarkuData.getWmoWeatherVisual(cur.weatherCode, cur.isDay);
  const daily = weatherData.daily || {};
  const hourly = weatherData.hourly || {};
  const todayIso = new Date().toISOString().slice(0, 10);
  const weatherIsLive = Boolean(weatherData && weatherData.live);
  const aqiIsLive = Boolean(aqiData && aqiData.live);

  const dailyForecast = (daily.time || []).map((dateStr, idx) => {
    const code = daily.weather_code && daily.weather_code[idx] != null ? daily.weather_code[idx] : 2;
    const dayVis = sekitarkuData.getWmoWeatherVisual(code, 1);
    const maxC = daily.temperature_2m_max && daily.temperature_2m_max[idx] != null ? daily.temperature_2m_max[idx] : 31;
    const minC = daily.temperature_2m_min && daily.temperature_2m_min[idx] != null ? daily.temperature_2m_min[idx] : 24;
    const dateObj = new Date(dateStr + 'T00:00:00Z');
    return {
      date: dateStr,
      day: new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' }).format(dateObj),
      dayFull: new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'UTC' }).format(dateObj),
      dateNum: Number(dateStr.slice(-2)),
      high: toFahrenheit(maxC),
      low: toFahrenheit(minC),
      highC: Math.round(maxC),
      lowC: Math.round(minC),
      condition: dayVis.label,
      icon: dayVis.owmIcon,
      rainChance: daily.precipitation_probability_max && daily.precipitation_probability_max[idx] != null ? Math.round(daily.precipitation_probability_max[idx]) : 20,
      wind: daily.wind_speed_10m_max && daily.wind_speed_10m_max[idx] != null ? Math.round(daily.wind_speed_10m_max[idx]) : 12,
      humidity: cur.humidity || 75,
      uvIndex: daily.uv_index_max && daily.uv_index_max[idx] != null ? Math.round(daily.uv_index_max[idx] * 10) / 10 : 6,
      today: idx === 0 || dateStr === todayIso
    };
  });

  const hourlyToday = [];
  const hourlyTomorrow = [];
  const times = hourly.time || [];
  const firstDate = times[0] ? String(times[0]).slice(0, 10) : todayIso;
  times.forEach((isoTime, idx) => {
    const datePart = String(isoTime).slice(0, 10);
    const timePart = String(isoTime).slice(11, 16) || '00:00';
    const code = hourly.weather_code && hourly.weather_code[idx] != null ? hourly.weather_code[idx] : 2;
    const hVis = sekitarkuData.getWmoWeatherVisual(code, 1);
    const tempC = hourly.temperature_2m && hourly.temperature_2m[idx] != null ? hourly.temperature_2m[idx] : 28;
    const item = {
      time: timePart,
      temp: toFahrenheit(tempC),
      tempC: Math.round(tempC),
      condition: hVis.label,
      icon: hVis.owmIcon,
      rain: hourly.precipitation_probability && hourly.precipitation_probability[idx] != null ? Math.round(hourly.precipitation_probability[idx]) : 10,
      humidity: hourly.relative_humidity_2m && hourly.relative_humidity_2m[idx] != null ? Math.round(hourly.relative_humidity_2m[idx]) : 75,
      wind: hourly.wind_speed_10m && hourly.wind_speed_10m[idx] != null ? Math.round(hourly.wind_speed_10m[idx]) : (cur.windSpeed || 10)
    };
    if (datePart === firstDate && hourlyToday.length < 24) hourlyToday.push(item);
    else if (datePart > firstDate && hourlyTomorrow.length < 24) hourlyTomorrow.push(item);
  });

  const aqiCur = (aqiData && aqiData.current) || {};
  const aqiInfo = sekitarkuData.getUsAqiInfo(aqiCur.aqi);
  const uvInfo = sekitarkuData.getUvInfo(cur.uvIndex);

  return {
    live: weatherIsLive,
    aqiLive: aqiIsLive,
    provider: 'Open-Meteo',
    source: weatherIsLive ? 'Open-Meteo' : 'contoh Open-Meteo (bukan live)',
    location: {
      name: location.name,
      region: location.province || location.region || 'Indonesia',
      country: 'Indonesia',
      latitude: location.lat,
      longitude: location.lon,
      timezone: location.lon >= 125 ? 'WIT (UTC+9)' : location.lon >= 114 ? 'WITA (UTC+8)' : 'WIB (UTC+7)'
    },
    current: {
      date: todayIso,
      observedAt: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }).format(new Date()) + ' WIB',
      temp: toFahrenheit(cur.temp),
      tempC: cur.temp,
      feelsLike: toFahrenheit(cur.feelsLike),
      feelsLikeC: cur.feelsLike,
      condition: visual.label,
      conditionCode: visual.owmIcon,
      icon: visual.owmIcon,
      high: dailyForecast[0] ? dailyForecast[0].high : toFahrenheit(cur.temp + 3),
      low: dailyForecast[0] ? dailyForecast[0].low : toFahrenheit(cur.temp - 4),
      humidity: cur.humidity,
      pressure: cur.pressure,
      wind: {
        speed: cur.windSpeed,
        direction: compassId(cur.windDirection),
        gust: cur.windGust == null ? null : Math.round(cur.windGust),
        unit: 'km/h'
      },
      rainChance: dailyForecast[0] ? dailyForecast[0].rainChance : 15,
      rainWindow: 'hari ini',
      visibility: cur.visibilityKm == null ? null : cur.visibilityKm,
      uvIndex: cur.uvIndex,
      uvDesc: uvInfo.label,
      sunrise: openMeteoClockLabel(daily.sunrise && daily.sunrise[0]) || '—',
      sunset: openMeteoClockLabel(daily.sunset && daily.sunset[0]) || '—'
    },
    dailyForecast,
    hourlyForecast: {
      today: hourlyToday,
      tomorrow: hourlyTomorrow
    },
    airQuality: {
      scale: 'US-EPA AQI (Open-Meteo)',
      index: aqiCur.aqi,
      category: aqiInfo.label,
      color: aqiInfo.color,
      advice: aqiInfo.advice,
      updatedAt: aqiCur.time || new Date().toISOString(),
      updatedAtLabel: 'Real-Time Open-Meteo',
      pollutants: [
        { name: 'PM2.5', description: 'Partikel halus', value: aqiCur.pm25, unit: 'µg/m³', index: aqiCur.aqi, category: aqiInfo.label },
        { name: 'PM10', description: 'Partikel inhalabel', value: aqiCur.pm10, unit: 'µg/m³', index: null, category: null },
        { name: 'NO₂', description: 'Nitrogen dioksida', value: aqiCur.no2, unit: 'µg/m³', index: null, category: null },
        { name: 'O₃', description: 'Ozon permukaan', value: aqiCur.o3, unit: 'µg/m³', index: null, category: null },
        { name: 'SO₂', description: 'Sulfur dioksida', value: aqiCur.so2, unit: 'µg/m³', index: null, category: null },
        { name: 'CO', description: 'Karbon monoksida', value: aqiCur.co, unit: 'µg/m³', index: null, category: null }
      ]
    }
  };
}

async function getSekitarkuBundle(params) {
  const queryCity = params && params.city ? sekitarkuData.findCityByName(params.city) : null;
  const rawLat = params && params.lat != null && params.lat !== '' ? Number(params.lat) : (queryCity ? queryCity.lat : -7.42);
  const rawLon = params && params.lon != null && params.lon !== '' ? Number(params.lon) : (queryCity ? queryCity.lon : 109.24);
  const safeLat = Number.isFinite(rawLat) && rawLat >= -90 && rawLat <= 90 ? rawLat : -7.42;
  const safeLon = Number.isFinite(rawLon) && rawLon >= -180 && rawLon <= 180 ? rawLon : 109.24;

  const nearestCity = queryCity || sekitarkuData.findNearestCity(safeLat, safeLon);
  const location = {
    name: (params && params.name) || (nearestCity && nearestCity.name) || 'Klumprit',
    province: (params && (params.province || params.region)) || (nearestCity && nearestCity.province) || 'Jawa Tengah',
    region: (params && params.region) || (nearestCity && nearestCity.region) || 'Jawa',
    lat: safeLat,
    lon: safeLon
  };

  const force = Boolean(params && params.force);
  const [weather, airQuality, earthquakes] = await Promise.all([
    fetchOpenMeteoWeather(safeLat, safeLon, force),
    fetchOpenMeteoAqi(safeLat, safeLon, force),
    fetchBmkgEarthquakes(force)
  ]);

  const ecoHealth = sekitarkuData.calculateEcoHealthScore(
    airQuality.current.aqi,
    weather.current.temp,
    weather.current.humidity,
    weather.current.uvIndex,
    airQuality.current.pm25
  );

  const volcanoes = sekitarkuData.getNearbyVolcanoes(safeLat, safeLon, 250);
  const fdrs = sekitarkuData.calculateFdrs(weather);
  const hotspots = sekitarkuData.getNearbyHotspots(safeLat, safeLon, 400);
  const haze = sekitarkuData.getHazeStatus(hotspots.nearest, airQuality.current.aqi, airQuality.current.pm25);

  const latestQuake = earthquakes.latest
    ? Object.assign({}, earthquakes.latest, {
        distanceKm: sekitarkuData.calculateDistance(safeLat, safeLon, earthquakes.latest.lat, earthquakes.latest.lon)
      })
    : null;

  const recentQuakes = (earthquakes.recent || []).slice(0, 15).map(q =>
    Object.assign({}, q, {
      distanceKm: sekitarkuData.calculateDistance(safeLat, safeLon, q.lat, q.lon)
    })
  );

  const cuacakuCompat = buildCuacaKuCompatibleWeather(location, weather, airQuality);

  return {
    meta: {
      app: 'CuacaKu x Sekitarku',
      live: Boolean(weather.live || airQuality.live || earthquakes.live),
      weatherLive: Boolean(weather.live),
      aqiLive: Boolean(airQuality.live),
      bmkgLive: Boolean(earthquakes.live),
      sources: ['BMKG InaTEWS', 'Open-Meteo Weather & UV', 'Open-Meteo / Copernicus AQI', 'PVMBG MAGMA ESDM', 'KLHK SiPongi+ / NASA FIRMS'],
      updatedAt: new Date().toISOString(),
      totalCities: sekitarkuData.INDONESIA_CITIES.length,
      totalVolcanoes: sekitarkuData.INDONESIA_VOLCANOES.length
    },
    location,
    ecoHealth,
    weather,
    airQuality,
    earthquake: {
      live: earthquakes.live,
      latest: latestQuake,
      recent: recentQuakes
    },
    volcano: {
      nearest: volcanoes.nearest,
      nearbyList: volcanoes.nearbyList.slice(0, 8),
      alertCount: volcanoes.alertCount
    },
    karhutla: {
      fdrs,
      haze,
      nearest: hotspots.nearest,
      nearbyCount: hotspots.nearbyList.length,
      totalInIndo: hotspots.totalInIndo
    },
    cuacakuCompat
  };
}

async function getWidgetPayload(params) {
  const bundle = await getSekitarkuBundle(params);
  const aqi = bundle.airQuality.current.aqi;
  const aqiInfo = sekitarkuData.getUsAqiInfo(aqi);
  return {
    app: 'Sekitarku x CuacaKu',
    city: bundle.location.name,
    province: bundle.location.province,
    lat: bundle.location.lat,
    lon: bundle.location.lon,
    temp: bundle.weather.current.temp,
    tempLabel: `${bundle.weather.current.temp}°C`,
    aqi,
    aqiStatus: aqiInfo.label,
    aqiColor: aqiInfo.color,
    pm25: bundle.airQuality.current.pm25,
    cigarettesEquivalent: bundle.ecoHealth.cigs,
    ecoHealthScore: bundle.ecoHealth.score,
    ecoHealthCategory: bundle.ecoHealth.category,
    humidity: `${bundle.weather.current.humidity}%`,
    windSpeed: `${bundle.weather.current.windSpeed} km/h`,
    nearestVolcano: bundle.volcano.nearest ? `${bundle.volcano.nearest.name} (${bundle.volcano.nearest.status.code}, ${bundle.volcano.nearest.distanceKm} km)` : null,
    latestEarthquake: bundle.earthquake.latest ? `M ${bundle.earthquake.latest.magnitude} · ${bundle.earthquake.latest.wilayah} (${bundle.earthquake.latest.potensi})` : null,
    source: 'BMKG & Open-Meteo',
    updatedAt: bundle.meta.updatedAt
  };
}

module.exports = {
  getDefaultAqi,
  getDefaultWeather,
  getDefaultEarthquake,
  fetchOpenMeteoWeather,
  fetchOpenMeteoAqi,
  fetchBmkgEarthquakes,
  getSekitarkuBundle,
  getWidgetPayload,
  buildCuacaKuCompatibleWeather
};
