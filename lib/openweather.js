'use strict';

// Logika OpenWeather bersama (konfigurasi, normalisasi, fetch, cache, dukungan Nasional 515+ Kota & GPS).
// Dipakai oleh fungsi serverless Vercel di api/*.js DAN server lokal scripts/dev-server.js.

const { URL } = require('node:url');
const sekitarkuData = require('../js/sekitarku-data.js');

const API_BASE = process.env.OPENWEATHER_API_BASE || 'https://api.openweathermap.org';
const API_KEY = String(process.env.OPENWEATHER_API_KEY || '').trim();
const LAT = Number(process.env.OPENWEATHER_LAT || -7.42);
const LON = Number(process.env.OPENWEATHER_LON || 109.24);
const TIME_ZONE = 'Asia/Jakarta';
const REFRESH_SECONDS = Math.max(600, Number(process.env.OPENWEATHER_REFRESH_SECONDS) || 600);
const WEATHER_CACHE_MS = REFRESH_SECONDS * 1000;
const ONE_CALL_ENABLED = String(process.env.OPENWEATHER_ONE_CALL_ENABLED || 'true').toLowerCase() !== 'false';
// Audit 14 Okt 2026: bila OpenWeather tidak dapat dijangkau / key belum diset, payload live
// tetap dialirkan dari Open-Meteo (tanpa key) supaya dashboard tidak diam-diam memakai data contoh.
const OPEN_METEO_FALLBACK_ENABLED = String(process.env.OPEN_METEO_FALLBACK_ENABLED || 'true').toLowerCase() !== 'false';

const weatherCacheByKey = new Map();

class ProviderError extends Error {
  constructor(status, code, publicMessage) {
    super(code);
    this.name = 'ProviderError';
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

function finite(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, places) {
  const number = finite(value);
  if (number == null) return null;
  const factor = Math.pow(10, places || 0);
  return Math.round(number * factor) / factor;
}

function resolveLocationContext(options) {
  if (!options || (options.lat == null && options.lon == null && !options.city && !options.name)) {
    return {
      name: 'Klumprit',
      region: 'Jawa Tengah',
      country: 'Indonesia',
      latitude: LAT,
      longitude: LON,
      timezone: 'WIB (UTC+7)'
    };
  }
  const byCity = options.city ? sekitarkuData.findCityByName(options.city) : null;
  const rawLat = finite(options.lat != null ? options.lat : byCity && byCity.lat);
  const rawLon = finite(options.lon != null ? options.lon : byCity && byCity.lon);
  const lat = rawLat != null && rawLat >= -90 && rawLat <= 90 ? rawLat : LAT;
  const lon = rawLon != null && rawLon >= -180 && rawLon <= 180 ? rawLon : LON;
  const nearest = byCity || sekitarkuData.findNearestCity(lat, lon);
  const isDefault = Math.abs(lat - LAT) < 0.001 && Math.abs(lon - LON) < 0.001 && !options.name && !options.city;
  if (isDefault) {
    return {
      name: 'Klumprit',
      region: 'Jawa Tengah',
      country: 'Indonesia',
      latitude: LAT,
      longitude: LON,
      timezone: 'WIB (UTC+7)'
    };
  }
  return {
    name: String(options.name || (nearest && nearest.name) || 'Klumprit').slice(0, 80),
    region: String(options.region || options.province || (nearest && nearest.province) || 'Jawa Tengah').slice(0, 80),
    country: 'Indonesia',
    latitude: lat,
    longitude: lon,
    timezone: lon >= 125 ? 'WIT (UTC+9)' : lon >= 114 ? 'WITA (UTC+8)' : 'WIB (UTC+7)'
  };
}

function localParts(value) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TIME_ZONE
  }).formatToParts(date);
  const result = {};
  for (const part of parts) if (part.type !== 'literal') result[part.type] = part.value;
  return result;
}

function dateKeyFromUnix(seconds) {
  const parts = localParts(Number(seconds) * 1000);
  return parts.year + '-' + parts.month + '-' + parts.day;
}

function clockFromUnix(seconds) {
  const parts = localParts(Number(seconds) * 1000);
  return parts.hour + ':' + parts.minute;
}

function timestampLabel(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TIME_ZONE
  }).format(date) + ' WIB';
}

function compass(degrees) {
  const value = finite(degrees);
  if (value == null) return '—';
  const labels = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
  return labels[Math.round(((value % 360) + 360) % 360 / 45) % 8];
}

function mphToKmh(value) {
  const speed = finite(value);
  return speed == null ? null : Math.round(speed * 1.60934);
}

function weatherDetails(record) {
  return record && Array.isArray(record.weather) && record.weather[0] ? record.weather[0] : {};
}

function getTimelineRecords(payload) {
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function getCurrentRecord(payload) {
  return getTimelineRecords(payload)[0] || null;
}

function aqiCategory(index) {
  const value = finite(index);
  if (value == null) return { label: 'Tidak tersedia', color: '#64748b', advice: 'Periksa sumber pemantauan resmi sebelum beraktivitas.' };
  const categories = {
    1: { label: 'Baik', color: '#22c55e', advice: 'Kualitas udara baik. Aktivitas luar ruang umumnya dapat dilakukan.' },
    2: { label: 'Cukup', color: '#84cc16', advice: 'Kualitas udara cukup. Kelompok sensitif dapat mengurangi paparan bila merasa tidak nyaman.' },
    3: { label: 'Sedang', color: '#f59e0b', advice: 'Kelompok sensitif sebaiknya membatasi aktivitas luar ruang yang berat.' },
    4: { label: 'Buruk', color: '#f97316', advice: 'Kurangi aktivitas luar ruang, terutama bagi kelompok sensitif.' },
    5: { label: 'Sangat Buruk', color: '#ef4444', advice: 'Batasi paparan luar ruang dan ikuti anjuran otoritas kesehatan setempat.' }
  };
  return categories[Math.max(1, Math.min(5, Math.round(value)))] || categories[5];
}

function normalizeAirQuality(payload) {
  const item = payload && Array.isArray(payload.list) ? payload.list[0] : null;
  if (!item) return null;
  const index = finite(item.main && item.main.aqi);
  const info = aqiCategory(index);
  const components = item.components || {};
  const pollutantSpecs = [
    ['pm2_5', 'PM2.5', 'Partikel halus'],
    ['pm10', 'PM10', 'Partikel inhalabel'],
    ['no2', 'NO₂', 'Nitrogen dioksida'],
    ['o3', 'O₃', 'Ozon permukaan'],
    ['so2', 'SO₂', 'Sulfur dioksida'],
    ['co', 'CO', 'Karbon monoksida']
  ];
  return {
    scale: 'OpenWeather AQI',
    index,
    category: info.label,
    color: info.color,
    advice: info.advice,
    updatedAt: item.dt ? new Date(item.dt * 1000).toISOString() : new Date().toISOString(),
    updatedAtLabel: item.dt ? timestampLabel(item.dt * 1000) : timestampLabel(new Date()),
    pollutants: pollutantSpecs.map(([key, name, description]) => ({
      name,
      description,
      value: finite(components[key]) == null ? null : round(components[key], 2),
      unit: 'µg/m³',
      index: null,
      category: null
    }))
  };
}

function normalizeDailyRecords(records, todayKey) {
  const result = [];
  const used = new Set();
  for (const record of records || []) {
    const date = dateKeyFromUnix(record.dt);
    if (!date || used.has(date)) continue;
    used.add(date);
    const weather = weatherDetails(record);
    const temps = record.temp || {};
    result.push({
      date,
      day: '',
      dayFull: '',
      dateNum: Number(date.slice(-2)),
      high: finite(temps.max),
      low: finite(temps.min),
      condition: weather.description || 'Kondisi tidak tersedia',
      icon: weather.icon || '',
      rainChance: finite(record.pop) == null ? null : Math.round(Number(record.pop) * 100),
      wind: mphToKmh(record.wind_speed),
      humidity: finite(record.humidity),
      uvIndex: finite(record.uvi),
      today: date === todayKey
    });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeBasicDailyRecords(forecast, todayKey) {
  const groups = new Map();
  for (const record of (forecast && Array.isArray(forecast.list) ? forecast.list : [])) {
    const date = dateKeyFromUnix(record.dt);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(record);
  }
  return Array.from(groups.keys()).sort().map(date => {
    const records = groups.get(date);
    const temperatures = records.map(record => finite(record.main && record.main.temp)).filter(value => value != null);
    const rainValues = records.map(record => finite(record.pop)).filter(value => value != null);
    const midday = records.find(record => clockFromUnix(record.dt) >= '11:00' && clockFromUnix(record.dt) <= '15:00') || records[Math.floor(records.length / 2)];
    const weather = weatherDetails(midday || records[0]);
    const winds = records.map(record => finite(record.wind && record.wind.speed)).filter(value => value != null);
    const humidity = records.map(record => finite(record.main && record.main.humidity)).filter(value => value != null);
    return {
      date,
      day: '',
      dayFull: '',
      dateNum: Number(date.slice(-2)),
      high: temperatures.length ? Math.max(...temperatures) : null,
      low: temperatures.length ? Math.min(...temperatures) : null,
      condition: weather.description || 'Kondisi tidak tersedia',
      icon: weather.icon || '',
      rainChance: rainValues.length ? Math.round(Math.max(...rainValues) * 100) : null,
      wind: winds.length ? mphToKmh(winds.reduce((sum, value) => sum + value, 0) / winds.length) : null,
      humidity: humidity.length ? Math.round(humidity.reduce((sum, value) => sum + value, 0) / humidity.length) : null,
      uvIndex: null,
      today: date === todayKey
    };
  });
}

function normalizeHourlyRecords(records) {
  const result = { today: [], tomorrow: [] };
  const todayKey = dateKeyFromUnix(Math.floor(Date.now() / 1000));
  const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowKey = dateKeyFromUnix(Math.floor(tomorrowDate.getTime() / 1000));
  for (const record of records || []) {
    const date = dateKeyFromUnix(record.dt);
    const key = date === todayKey ? 'today' : date === tomorrowKey ? 'tomorrow' : null;
    if (!key) continue;
    const weather = weatherDetails(record);
    const windSpeed = record.wind_speed != null ? record.wind_speed : record.wind && record.wind.speed;
    result[key].push({
      time: clockFromUnix(record.dt),
      timestamp: Number(record.dt) * 1000,
      temp: finite(record.temp != null ? record.temp : record.main && record.main.temp),
      condition: weather.description || 'Kondisi tidak tersedia',
      icon: weather.icon || '',
      rain: finite(record.pop) == null ? null : Math.round(Number(record.pop) * 100),
      humidity: finite(record.humidity != null ? record.humidity : record.main && record.main.humidity),
      wind: mphToKmh(windSpeed)
    });
  }
  result.today.sort((a, b) => a.timestamp - b.timestamp);
  result.tomorrow.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}

function normalizeBasicHourlyRecords(forecast) {
  const result = normalizeHourlyRecords(forecast && forecast.list || []);
  return result;
}

function uvDescription(value) {
  if (value == null) return 'Tidak tersedia';
  if (value >= 11) return 'Ekstrem';
  if (value >= 8) return 'Sangat tinggi';
  if (value >= 6) return 'Tinggi';
  if (value >= 3) return 'Sedang';
  return 'Rendah';
}

function normalizeCurrentFromOneCall(record, dailyRecords, hourlyRecords) {
  if (!record) return null;
  const weather = weatherDetails(record);
  const todayKey = dateKeyFromUnix(record.dt);
  const todayForecast = (dailyRecords || []).find(item => dateKeyFromUnix(item.dt) === todayKey) || (dailyRecords || [])[0] || {};
  const nextHour = (hourlyRecords || [])[0] || {};
  const temps = todayForecast.temp || {};
  const rainProbability = finite(nextHour.pop != null ? nextHour.pop : todayForecast.pop);
  return {
    date: todayKey,
    observedAt: clockFromUnix(record.dt) + ' WIB',
    temp: finite(record.temp),
    feelsLike: finite(record.feels_like),
    condition: weather.description || 'Kondisi tidak tersedia',
    conditionCode: weather.icon || '',
    icon: weather.icon || '',
    high: finite(temps.max),
    low: finite(temps.min),
    humidity: finite(record.humidity),
    wind: {
      speed: mphToKmh(record.wind_speed),
      direction: compass(record.wind_deg),
      gust: mphToKmh(record.wind_gust),
      unit: 'km/h'
    },
    rainChance: rainProbability == null ? null : Math.round(rainProbability * 100),
    rainWindow: 'jam berikutnya',
    visibility: finite(record.visibility) == null ? null : round(Number(record.visibility) / 1000, 1),
    uvIndex: finite(record.uvi),
    uvDesc: uvDescription(finite(record.uvi)),
    sunrise: record.sunrise ? clockFromUnix(record.sunrise) : '—',
    sunset: record.sunset ? clockFromUnix(record.sunset) : '—'
  };
}

function normalizeCurrentFromBasic(current, forecast) {
  if (!current) return null;
  const weather = weatherDetails(current);
  const timestamp = finite(current.dt) || Math.floor(Date.now() / 1000);
  const todayKey = dateKeyFromUnix(timestamp);
  const daily = normalizeBasicDailyRecords(forecast, todayKey).find(day => day.date === todayKey) || {};
  const nextRecord = (forecast && Array.isArray(forecast.list) ? forecast.list : []).find(item => Number(item.dt) >= timestamp) || {};
  const nextRain = finite(nextRecord.pop);
  const wind = current.wind || {};
  return {
    date: todayKey,
    observedAt: clockFromUnix(timestamp) + ' WIB',
    temp: finite(current.main && current.main.temp),
    feelsLike: finite(current.main && current.main.feels_like),
    condition: weather.description || 'Kondisi tidak tersedia',
    conditionCode: weather.icon || '',
    icon: weather.icon || '',
    high: finite(daily.high),
    low: finite(daily.low),
    humidity: finite(current.main && current.main.humidity),
    wind: { speed: mphToKmh(wind.speed), direction: compass(wind.deg), gust: mphToKmh(wind.gust), unit: 'km/h' },
    rainChance: nextRain == null ? null : Math.round(nextRain * 100),
    rainWindow: 'interval prakiraan berikutnya',
    visibility: finite(current.visibility) == null ? null : round(Number(current.visibility) / 1000, 1),
    uvIndex: null,
    uvDesc: 'Tidak tersedia dari endpoint OpenWeather yang dipakai',
    sunrise: current.sys && current.sys.sunrise ? clockFromUnix(current.sys.sunrise) : '—',
    sunset: current.sys && current.sys.sunset ? clockFromUnix(current.sys.sunset) : '—'
  };
}

function normalizeMinuteCast(payload) {
  const records = getTimelineRecords(payload);
  return {
    intervalMinutes: 1,
    precipitationProbability: records.map(record => {
      const probability = finite(record.pop);
      return probability == null ? 0 : Math.max(0, Math.min(100, Math.round(probability * 100)));
    })
  };
}

function makePayload({ current, daily, hourly, minutely, airQuality, currentSource, dailySource, hourlyStepMinutes, oneCallAvailable, airQualityError, locationContext, providerMeta, fallback }) {
  const now = new Date();
  const todayKey = dateKeyFromUnix(Math.floor(now.getTime() / 1000));
  const dailyForecast = daily || [];
  dailyForecast.forEach(day => {
    const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' }).format(new Date(day.date + 'T00:00:00Z'));
    const weekdayFull = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'UTC' }).format(new Date(day.date + 'T00:00:00Z'));
    day.day = weekday;
    day.dayFull = weekdayFull;
    day.today = day.date === todayKey;
  });
  const localNow = localParts(now);
  const currentDate = current && current.date || todayKey;
  const currentDateParts = currentDate.split('-');
  const currentSnapshotDate = currentDateParts.join('-');
  const snapshotLabel = timestampLabel(now);
  const air = airQuality || {
    scale: 'OpenWeather AQI', index: null, category: 'Tidak tersedia',
    color: '#64748b', advice: 'Data kualitas udara OpenWeather belum tersedia.',
    updatedAt: null, updatedAtLabel: 'Tidak tersedia', pollutants: []
  };
  const minute = minutely ? normalizeMinuteCast(minutely) : { intervalMinutes: 1, precipitationProbability: [] };
  const hourData = hourly || { today: [], tomorrow: [] };
  const oneCallIsAvailable = Boolean(oneCallAvailable);
  const resolvedLoc = locationContext || {
    name: 'Klumprit', region: 'Jawa Tengah', country: 'Indonesia',
    latitude: LAT, longitude: LON, timezone: 'WIB (UTC+7)'
  };
  const sourceLabel = (providerMeta && providerMeta.source) || 'OpenWeather API';
  const providerName = (providerMeta && providerMeta.name) || 'OpenWeather';
  const sourceLabels = providerMeta && providerMeta.urls ? providerMeta.urls : {
    currentWeatherUrl: 'https://openweathermap.org/current',
    weatherUrl: 'https://openweathermap.org/forecast5',
    dailyForecastUrl: 'https://openweathermap.org/api/one-call-4',
    hourlyTomorrowUrl: 'https://openweathermap.org/api/one-call-4',
    airQualityUrl: 'https://openweathermap.org/api/air-pollution'
  };
  const moduleOverrides = (providerMeta && providerMeta.modules) || {};
  return {
    meta: {
      source: sourceLabel,
      providerName,
      live: Boolean(current),
      temperatureUnit: 'F',
      snapshotDate: currentSnapshotDate,
      snapshotTime: localNow.hour + ':' + localNow.minute,
      snapshotTimezone: 'WIB',
      snapshotLabel,
      refreshedAt: now.toISOString(),
      currentWeatherUrl: sourceLabels.currentWeatherUrl,
      weatherUrl: sourceLabels.weatherUrl,
      dailyForecastUrl: sourceLabels.dailyForecastUrl,
      hourlyTomorrowUrl: sourceLabels.hourlyTomorrowUrl,
      airQualityUrl: sourceLabels.airQualityUrl,
      fallback: fallback || null
    },
    provider: {
      name: providerName,
      refreshIntervalSeconds: REFRESH_SECONDS,
      modules: {
        current: Object.assign({ live: Boolean(current), product: currentSource || 'OpenWeather' }, moduleOverrides.current || {}),
        dailyForecast: Object.assign({ live: Boolean(dailyForecast.length), days: dailyForecast.length, product: dailySource || 'OpenWeather' }, moduleOverrides.dailyForecast || {}),
        hourlyForecast: Object.assign({ live: Boolean(hourData.today.length || hourData.tomorrow.length), intervalMinutes: hourlyStepMinutes || null, product: hourlyStepMinutes === 60 ? 'One Call API 4.0' : '5-day / 3-hour Forecast' }, moduleOverrides.hourlyForecast || {}),
        minuteCast: Object.assign({ live: Boolean(minute.precipitationProbability.length), product: oneCallIsAvailable ? 'One Call API 4.0 · 1-minute timeline' : 'One Call API 4.0 diperlukan' }, moduleOverrides.minuteCast || {}),
        airQuality: Object.assign({ live: Boolean(airQuality), product: 'Air Pollution API', error: airQualityError || null }, moduleOverrides.airQuality || {}),
        monthly: Object.assign({ live: false, product: oneCallIsAvailable ? 'One Call API 4.0 · perlu diminta per bulan' : 'One Call API 4.0 diperlukan' }, moduleOverrides.monthly || {}),
        radar: Object.assign({ live: false, product: 'Weather Maps / Global Precipitation Maps memerlukan akses peta' }, moduleOverrides.radar || {})
      }
    },
    location: resolvedLoc,
    current,
    dailyForecast,
    hourlyForecast: hourData,
    minuteCast: minute,
    monthlyMonth: { year: Number(currentSnapshotDate.slice(0, 4)), month: Number(currentSnapshotDate.slice(5, 7)) },
    airQuality: air,
    radarFrames: null
  };
}

function apiUrl(pathname, params, locCtx) {
  const url = new URL(pathname, API_BASE);
  url.searchParams.set('appid', API_KEY);
  url.searchParams.set('lat', String(locCtx ? locCtx.latitude : LAT));
  url.searchParams.set('lon', String(locCtx ? locCtx.longitude : LON));
  if (pathname.includes('/data/4.0/')) {
    url.searchParams.set('units', 'imperial');
    url.searchParams.set('lang', 'id');
  }
  for (const [key, value] of Object.entries(params || {})) {
    if (value != null) url.searchParams.set(key, String(value));
  }
  return url;
}

async function fetchProviderJson(url, endpointLabel) {
  let response;
  try {
    response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000)
    });
  } catch (error) {
    throw new ProviderError(502, 'OPENWEATHER_UNREACHABLE', 'OpenWeather tidak dapat dijangkau saat ini.');
  }
  let body;
  try {
    body = await response.json();
  } catch (error) {
    body = null;
  }
  if (!response.ok) {
    const status = response.status;
    const code = status === 401 || status === 403 ? 'OPENWEATHER_PRODUCT_UNAVAILABLE' : 'OPENWEATHER_REQUEST_FAILED';
    const message = status === 401 || status === 403
      ? 'Key atau langganan OpenWeather belum memiliki akses ke salah satu produk yang diminta.'
      : 'OpenWeather gagal memproses permintaan cuaca.';
    // Do not log/return the request URL or provider body: either could carry the API key.
    const failure = new ProviderError(status, code, message);
    failure.endpoint = endpointLabel;
    throw failure;
  }
  return body || {};
}

async function getOwm(pathname, params, label, locCtx) {
  return fetchProviderJson(apiUrl(pathname, params, locCtx), label || pathname);
}

function safeNextUrl(next) {
  if (!next) return null;
  try {
    const url = new URL(next, API_BASE);
    const allowedHost = new URL(API_BASE).hostname;
    if (url.protocol !== 'https:' && allowedHost !== 'localhost' && allowedHost !== '127.0.0.1') return null;
    if (url.hostname !== allowedHost || !url.pathname.startsWith('/data/4.0/onecall/timeline/')) return null;
    url.searchParams.set('appid', API_KEY);
    url.searchParams.set('units', 'imperial');
    url.searchParams.set('lang', 'id');
    return url;
  } catch (error) {
    return null;
  }
}

async function getTimeline(pathname, maxPages, locCtx) {
  const first = await getOwm(pathname, null, pathname, locCtx);
  const records = getTimelineRecords(first).slice();
  let next = safeNextUrl(first.next);
  let pages = 1;
  while (next && pages < maxPages) {
    const page = await fetchProviderJson(next, pathname + ' (continuation)');
    records.push(...getTimelineRecords(page));
    next = safeNextUrl(page.next);
    pages += 1;
  }
  return { data: records, pages };
}

async function fetchAirQuality(locCtx) {
  try {
    const payload = await getOwm('/data/2.5/air_pollution', null, 'Air Pollution API', locCtx);
    return { data: normalizeAirQuality(payload), error: null };
  } catch (error) {
    return { data: null, error: error.code || 'OPENWEATHER_AIR_QUALITY_UNAVAILABLE' };
  }
}

async function fetchOneCallWeather(locCtx) {
  const currentPayload = await getOwm('/data/4.0/onecall/current', null, 'One Call API 4.0 current', locCtx);
  const [minuteResult, hourlyResult, dailyResult, airResult] = await Promise.allSettled([
    getTimeline('/data/4.0/onecall/timeline/1min', 1, locCtx),
    getTimeline('/data/4.0/onecall/timeline/1h', 3, locCtx),
    getTimeline('/data/4.0/onecall/timeline/1day', 1, locCtx),
    fetchAirQuality(locCtx)
  ]);
  const minutely = minuteResult.status === 'fulfilled' ? minuteResult.value : null;
  const hourly = hourlyResult.status === 'fulfilled' ? hourlyResult.value : null;
  const daily = dailyResult.status === 'fulfilled' ? dailyResult.value : null;
  const air = airResult.status === 'fulfilled' ? airResult.value : { data: null, error: 'OPENWEATHER_AIR_QUALITY_UNAVAILABLE' };
  const currentRecord = getCurrentRecord(currentPayload);
  const dailyRecords = daily && daily.data || [];
  const hourlyRecords = hourly && hourly.data || [];
  const normalizedDaily = normalizeDailyRecords(dailyRecords, currentRecord ? dateKeyFromUnix(currentRecord.dt) : dateKeyFromUnix(Date.now() / 1000));
  const normalizedHourly = normalizeHourlyRecords(hourlyRecords);
  const current = normalizeCurrentFromOneCall(currentRecord, dailyRecords, hourlyRecords);
  return makePayload({
    current,
    daily: normalizedDaily,
    hourly: normalizedHourly,
    minutely: minutely && minutely.data.length ? minutely : null,
    airQuality: air.data,
    currentSource: 'One Call API 4.0',
    dailySource: 'One Call API 4.0 · hingga 10 hari',
    hourlyStepMinutes: 60,
    oneCallAvailable: true,
    airQualityError: air.error,
    locationContext: locCtx
  });
}

async function fetchBasicWeather(oneCallError, locCtx) {
  const [currentResult, forecastResult, airResult] = await Promise.allSettled([
    getOwm('/data/2.5/weather', { units: 'imperial', lang: 'id' }, 'Current Weather Data API', locCtx),
    getOwm('/data/2.5/forecast', { units: 'imperial', lang: 'id' }, '5-day / 3-hour Forecast API', locCtx),
    fetchAirQuality(locCtx)
  ]);
  if (currentResult.status !== 'fulfilled' || forecastResult.status !== 'fulfilled') {
    const failure = currentResult.status !== 'fulfilled' ? currentResult.reason : forecastResult.reason;
    if (failure instanceof ProviderError) throw failure;
    throw new ProviderError(502, 'OPENWEATHER_REQUEST_FAILED', 'OpenWeather gagal memuat cuaca saat ini dan prakiraan.');
  }
  const currentBody = currentResult.value;
  const forecastBody = forecastResult.value;
  const todayKey = dateKeyFromUnix(currentBody.dt || Date.now() / 1000);
  const daily = normalizeBasicDailyRecords(forecastBody, todayKey);
  const hourly = normalizeBasicHourlyRecords(forecastBody);
  const air = airResult.status === 'fulfilled' ? airResult.value : { data: null, error: 'OPENWEATHER_AIR_QUALITY_UNAVAILABLE' };
  return makePayload({
    current: normalizeCurrentFromBasic(currentBody, forecastBody),
    daily,
    hourly,
    minutely: null,
    airQuality: air.data,
    currentSource: 'Current Weather Data API',
    dailySource: '5-day / 3-hour Forecast API (maks. 5 hari)',
    hourlyStepMinutes: 180,
    oneCallAvailable: false,
    airQualityError: air.error || (oneCallError && oneCallError.code) || null,
    locationContext: locCtx
  });
}

async function fetchOpenWeatherWeather(locCtx) {
  if (ONE_CALL_ENABLED) {
    try {
      return await fetchOneCallWeather(locCtx);
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      // Kegagalan jaringan berlaku untuk seluruh host OpenWeather: jangan buang ~10 detik lagi
      // mencoba endpoint dasar yang akan menemui masalah sama — langsung pakai penyedia cadangan.
      if (error.code === 'OPENWEATHER_UNREACHABLE') throw error;
      // One Call is an optional product; fall back to standard endpoints when the key is not subscribed.
      return fetchBasicWeather(error, locCtx);
    }
  }
  return fetchBasicWeather(null, locCtx);
}

/**
 * Jalur cadangan live (audit 14 Okt 2026): Open-Meteo tanpa API key.
 * Dipakai hanya bila OpenWeather gagal; payload ditandai jelas lewat meta.source,
 * meta.fallback, dan provider.modules supaya UI tidak pernah mengklaim angka contoh sebagai live.
 */
function describeAttempt(error, providerName) {
  if (error instanceof ProviderError) {
    return { provider: error.endpoint ? providerName + ' · ' + error.endpoint : providerName, code: error.code, message: error.publicMessage, status: error.status };
  }
  return { provider: providerName, code: 'WEATHER_PROVIDER_ERROR', message: 'Penyedia data mengembalikan kesalahan tak terduga.', status: 502 };
}

function openMeteoAirQualityOrNull(compat, airQuality) {
  if (compat && compat.aqiLive === true) return compat.airQuality;
  if (airQuality && airQuality.live === true && airQuality.current) {
    const index = finite(airQuality.current.aqi);
    return {
      scale: 'US-EPA AQI (Open-Meteo)',
      index,
      category: index == null ? 'Tidak tersedia' : 'Tersedia',
      color: '#64748b',
      advice: 'Untuk keputusan kesehatan resmi di Indonesia, rujuk ISPU KLHK.',
      updatedAt: airQuality.current.time || null,
      updatedAtLabel: index == null ? 'Tidak tersedia' : 'Real-Time Open-Meteo',
      pollutants: []
    };
  }
  return {
    scale: 'US-EPA AQI (Open-Meteo)',
    index: null,
    category: 'Tidak tersedia',
    color: '#64748b',
    advice: 'Data kualitas udara live belum tersedia dari penyedia mana pun; rujuk ISPU KLHK untuk angka resmi.',
    updatedAt: null,
    updatedAtLabel: 'Tidak tersedia',
    pollutants: []
  };
}

async function fetchFromOpenMeteo(locCtx, attempts) {
  // require lazy: menghindari siklus muat dengan api/*.js yang memakai sendJson dari modul ini.
  const sekitarkuProvider = require('./sekitarku.js');
  const [weather, airQuality] = await Promise.all([
    sekitarkuProvider.fetchOpenMeteoWeather(locCtx.latitude, locCtx.longitude, false),
    sekitarkuProvider.fetchOpenMeteoAqi(locCtx.latitude, locCtx.longitude, false)
  ]);
  if (!weather || weather.live !== true) {
    throw new ProviderError(502, 'OPEN_METEO_UNAVAILABLE', 'Open-Meteo tidak dapat dijangkau saat ini.');
  }
  const compat = sekitarkuProvider.buildCuacaKuCompatibleWeather({
    name: locCtx.name,
    province: locCtx.region,
    region: locCtx.region,
    lat: locCtx.latitude,
    lon: locCtx.longitude
  }, weather, airQuality);
  const airIsLive = Boolean(compat && compat.aqiLive === true);
  return makePayload({
    current: compat.current,
    daily: compat.dailyForecast,
    hourly: compat.hourlyForecast,
    minutely: null,
    airQuality: openMeteoAirQualityOrNull(compat, airQuality),
    currentSource: 'Open-Meteo Forecast API',
    dailySource: 'Open-Meteo Forecast API · 7 hari',
    hourlyStepMinutes: 60,
    oneCallAvailable: false,
    airQualityError: airIsLive ? null : 'OPEN_METEO_AQI_UNAVAILABLE',
    locationContext: locCtx,
    providerMeta: {
      name: 'Open-Meteo',
      source: 'Open-Meteo',
      urls: {
        currentWeatherUrl: 'https://open-meteo.com/en/docs',
        weatherUrl: 'https://open-meteo.com/en/docs',
        dailyForecastUrl: 'https://open-meteo.com/en/docs',
        hourlyTomorrowUrl: 'https://open-meteo.com/en/docs',
        airQualityUrl: 'https://open-meteo.com/en/docs/air-quality-api'
      },
      modules: {
        current: { product: 'Open-Meteo Forecast API (best_match)' },
        dailyForecast: { product: 'Open-Meteo Forecast API · hingga 7 hari' },
        hourlyForecast: { product: 'Open-Meteo Forecast API · per jam' },
        minuteCast: { live: false, product: 'Open-Meteo tidak menyediakan timeline per menit' },
        airQuality: airIsLive
          ? { product: 'Open-Meteo / Copernicus Atmosphere · US-EPA AQI' }
          : { live: false, product: 'Open-Meteo / Copernicus Atmosphere · tidak tersedia' },
        monthly: { live: false, product: 'Timeline per bulan memerlukan One Call API 4.0' },
        radar: { live: false, product: 'Radar peta tetap simulasi (produk peta terpisah)' }
      }
    },
    fallback: {
      from: 'OpenWeather',
      provider: 'Open-Meteo',
      attempts: attempts.slice(),
      note: 'OpenWeather tidak tersedia; angka live pada payload ini berasal dari Open-Meteo (tanpa API key).'
    }
  });
}

let lastProviderReport = null;

async function fetchWeather(options) {
  const locCtx = resolveLocationContext(options);
  const attempts = [];
  if (API_KEY) {
    try {
      const payload = await fetchOpenWeatherWeather(locCtx);
      lastProviderReport = { at: new Date().toISOString(), provider: 'OpenWeather', ok: true, fallbackUsed: false, attempts };
      return payload;
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      attempts.push(describeAttempt(error, 'OpenWeather'));
    }
  } else {
    attempts.push({
      provider: 'OpenWeather',
      code: 'OPENWEATHER_API_KEY_NOT_CONFIGURED',
      message: 'OPENWEATHER_API_KEY belum dikonfigurasi di server.',
      status: 503
    });
  }

  if (OPEN_METEO_FALLBACK_ENABLED) {
    try {
      const payload = await fetchFromOpenMeteo(locCtx, attempts);
      lastProviderReport = { at: new Date().toISOString(), provider: 'Open-Meteo', ok: true, fallbackUsed: true, attempts };
      return payload;
    } catch (error) {
      attempts.push(describeAttempt(error, 'Open-Meteo'));
    }
  }

  lastProviderReport = { at: new Date().toISOString(), provider: null, ok: false, fallbackUsed: false, attempts };
  const unavailable = new ProviderError(502, 'WEATHER_PROVIDERS_UNAVAILABLE', 'Semua penyedia data cuaca live tidak dapat dijangkau saat ini.');
  unavailable.attempts = attempts;
  throw unavailable;
}

async function getCachedWeather(options) {
  const locCtx = resolveLocationContext(options);
  const cacheKey = `${locCtx.latitude.toFixed(3)},${locCtx.longitude.toFixed(3)},${locCtx.name}`;
  const now = Date.now();
  const existing = weatherCacheByKey.get(cacheKey);
  if (existing && existing.payload && existing.expiresAt > now) return existing.payload;
  if (existing && existing.error && existing.expiresAt > now) throw existing.error;
  if (existing && existing.promise) return existing.promise;
  const promise = fetchWeather(options).then(payload => {
    weatherCacheByKey.set(cacheKey, { payload, expiresAt: Date.now() + WEATHER_CACHE_MS });
    return payload;
  }).catch(error => {
    weatherCacheByKey.set(cacheKey, { error, expiresAt: Date.now() + Math.min(60_000, WEATHER_CACHE_MS) });
    throw error;
  });
  weatherCacheByKey.set(cacheKey, { promise, expiresAt: now + Math.min(10_000, WEATHER_CACHE_MS) });
  return promise;
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-length': Buffer.byteLength(body)
  });
  response.end(body);
}

function apiError(response, error) {
  const status = error instanceof ProviderError ? error.status : 502;
  const code = error instanceof ProviderError ? error.code : 'OPENWEATHER_REQUEST_FAILED';
  const message = error instanceof ProviderError ? error.publicMessage : 'OpenWeather gagal memuat data.';
  const body = { error: { code, message }, provider: 'OpenWeather', providerChain: ['OpenWeather', 'Open-Meteo'] };
  // Rincian percobaan membantu UI menjelaskan penyebab tanpa membocorkan key/URL provider.
  if (error && Array.isArray(error.attempts) && error.attempts.length) body.attempts = error.attempts;
  sendJson(response, status, body);
}

function healthPayload() {
  return {
    provider: 'OpenWeather',
    configured: Boolean(API_KEY),
    refreshIntervalSeconds: REFRESH_SECONDS,
    oneCallEnabled: ONE_CALL_ENABLED,
    providers: {
      primary: { name: 'OpenWeather', configured: Boolean(API_KEY), oneCallEnabled: ONE_CALL_ENABLED },
      fallback: { name: 'Open-Meteo', enabled: OPEN_METEO_FALLBACK_ENABLED, requiresKey: false }
    },
    lastFetch: lastProviderReport,
    location: { latitude: LAT, longitude: LON, name: 'Klumprit, Jawa Tengah' },
    nationalCitiesCount: sekitarkuData.INDONESIA_CITIES.length,
    volcanoesCount: sekitarkuData.INDONESIA_VOLCANOES.length,
    sekitarkuSources: ['BMKG InaTEWS', 'Open-Meteo Weather & AQI', 'PVMBG MAGMA ESDM']
  };
}

module.exports = {
  ProviderError,
  aqiCategory,
  normalizeAirQuality,
  normalizeDailyRecords,
  normalizeBasicDailyRecords,
  normalizeHourlyRecords,
  normalizeMinuteCast,
  resolveLocationContext,
  getCachedWeather,
  sendJson,
  apiError,
  healthPayload
};
