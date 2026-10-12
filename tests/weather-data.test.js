const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/data.js'), 'utf8');
const WEATHER_DATA = vm.runInNewContext(source + '\nWEATHER_DATA;', {});
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

test('weather and AQI source data carries explicit snapshot provenance and is not marked live', () => {
  assert.equal(WEATHER_DATA.meta.live, false);
  assert.equal(WEATHER_DATA.meta.temperatureUnit, 'F');
  assert.equal(WEATHER_DATA.meta.snapshotDate, '2026-10-12');
  assert.equal(WEATHER_DATA.meta.snapshotTime, '21:37');
  assert.equal(WEATHER_DATA.meta.snapshotTimezone, 'WIB');
  assert.equal(WEATHER_DATA.meta.source, 'AccuWeather web snapshot (dicocokkan manual)');
  assert.match(WEATHER_DATA.meta.currentWeatherUrl, /current-weather\/3454553$/);
  assert.match(WEATHER_DATA.meta.dailyForecastUrl, /10-day-weather-forecast\/3454553$/);
  assert.match(WEATHER_DATA.meta.hourlyTomorrowUrl, /hourly-weather-forecast\/3454553\?day=2$/);
  assert.match(WEATHER_DATA.meta.airQualityUrl, /air-quality-index\/3454553$/);
});

test('Celsius is the first-visit default while stored Fahrenheit remains a supported preference', () => {
  assert.match(appSource, /isCelsius: readSavedUnit\(\)/);
  assert.match(appSource, /function readSavedUnit\(\)[\s\S]*?return window\.localStorage\.getItem\(UNIT_STORAGE_KEY\) !== 'F';[\s\S]*?return true;/);
  assert.match(html, /id="btn-unit"/);
  assert.match(html, /id="btn-unit-mobile"/);
});

test('AccuWeather current snapshot corrects the old 30 C display to 24 C', () => {
  assert.equal(WEATHER_DATA.location.code, 3454553);
  assert.equal(WEATHER_DATA.current.temp, 76);
  assert.equal(WEATHER_DATA.toCelsius(WEATHER_DATA.current.temp), 24);
  assert.equal(WEATHER_DATA.toCelsius(WEATHER_DATA.current.feelsLike), 27);
  assert.equal(WEATHER_DATA.current.humidity, 91);
  assert.equal(WEATHER_DATA.current.wind.speedMph, 8);
  assert.equal(WEATHER_DATA.current.wind.speed, 13);
  assert.equal(WEATHER_DATA.current.wind.gustMph, 14);
  assert.equal(WEATHER_DATA.current.wind.gust, 23);
  assert.equal(WEATHER_DATA.current.visibilityMiles, 6);
  assert.equal(WEATHER_DATA.current.uvIndex, null, 'unavailable UV must not be invented');
  assert.equal(WEATHER_DATA.toCelsius(32), 0);
  assert.equal(WEATHER_DATA.toCelsius(86), 30);
  assert.equal(WEATHER_DATA.toFahrenheit(0), 32);
  assert.equal(WEATHER_DATA.toFahrenheit(30), 86);
  assert.match(html, /id="current-temp">24°C</);
  assert.match(html, /id="detail-uv">Tidak tersedia</);
});

test('10-day source snapshot has ten consecutive dates and unavailable humidity remains null', () => {
  assert.equal(WEATHER_DATA.dailyForecast.length, 10);
  WEATHER_DATA.dailyForecast.forEach((day, index) => {
    const expectedDate = new Date(Date.UTC(2026, 9, 12 + index)).toISOString().slice(0, 10);
    assert.equal(day.date, expectedDate);
    const expectedWeekday = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'UTC' }).format(new Date(day.date + 'T00:00:00Z'));
    assert.equal(day.dayFull, expectedWeekday);
    assert.ok(day.high >= day.low, day.date + ' high should not be below low');
    assert.ok(day.rainChance >= 0 && day.rainChance <= 100);
    assert.equal(day.humidity, null, 'humidity is not available in the source summary');
  });
  assert.equal(WEATHER_DATA.dailyForecast[0].today, true);
  assert.equal(WEATHER_DATA.dailyForecast[0].uvIndex, null);
  assert.match(appSource, /day\.humidity == null \? '—'/, 'null humidity should render as unavailable');
  assert.match(appSource, /day\.uvIndex == null \? '—'/, 'null UV should render as unavailable');
});

test('hourly snapshot preserves the two remaining current-day hours and 24 following-day hours', () => {
  const today = WEATHER_DATA.hourlyForecast.today;
  const tomorrow = WEATHER_DATA.hourlyForecast.tomorrow;
  assert.equal(today.length, 2);
  assert.deepEqual(Array.from(today, hour => hour.time), ['22:00', '23:00']);
  assert.equal(tomorrow.length, 24);
  tomorrow.forEach((hour, index) => {
    assert.equal(hour.time, String(index).padStart(2, '0') + ':00');
  });
  for (const hour of [...today, ...tomorrow]) {
    assert.ok(hour.rain >= 0 && hour.rain <= 100);
    assert.ok(hour.humidity >= 0 && hour.humidity <= 100);
    assert.ok(hour.temp > 32 && hour.temp < 120, 'source temperature should remain in Fahrenheit');
  }
  assert.match(html, /Sisa malam · 12 Okt/);
  assert.match(html, /13 Okt/);
});

test('AQI and pollutant snapshot retain AccuWeather categories, units, and timestamp', () => {
  const air = WEATHER_DATA.airQuality;
  assert.equal(air.scale, 'AccuWeather AQI');
  assert.equal(air.index, 205);
  assert.equal(air.category, 'Sangat Tidak Sehat');
  assert.equal(air.updatedAt, '2026-10-12T21:37:00+07:00');
  assert.equal(air.pollutants.length, 6);
  assert.deepEqual(Array.from(air.pollutants, pollutant => pollutant.name), ['PM2.5', 'PM10', 'NO₂', 'O₃', 'SO₂', 'CO']);
  assert.ok(air.pollutants.every(pollutant => pollutant.value > 0 && pollutant.index >= 0 && pollutant.unit === 'µg/m³'));
  assert.match(html, /AccuWeather AQI/);
  assert.match(html, /AQI polutan/);
  assert.doesNotMatch(html, /Indeks Standar Pencemar Udara|ISPU contoh/);
  assert.match(appSource, /aqi\.index \+ ' \(' \+ aqiInfo\.label/);
  assert.match(appSource, /current\.uvIndex >= 8/);
  assert.match(appSource, /missingUvPenalty/);
});

test('monthly data is explicitly local, covers October 2026, and retains its known missing day', () => {
  assert.equal(WEATHER_DATA.monthlyMonth.year, 2026);
  assert.equal(WEATHER_DATA.monthlyMonth.month, 10);
  assert.equal(WEATHER_DATA.monthlyData.length, 31);
  WEATHER_DATA.monthlyData.forEach((day, index) => {
    assert.equal(day.date, index + 1);
    const date = new Date(Date.UTC(2026, 9, day.date));
    const expectedWeekday = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' }).format(date);
    assert.equal(day.day, expectedWeekday);
  });
  const missing = Array.from(WEATHER_DATA.monthlyData).filter(day => day.high === null || day.low === null);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].date, 11);
  assert.match(html, /Data contoh tersedia untuk Oktober 2026 saja/);
});

test('MinuteCast and radar are clearly local simulations with bounded data', () => {
  const probabilities = WEATHER_DATA.minuteCast.precipitationProbability;
  assert.equal(probabilities.length, 24);
  assert.ok(probabilities.every(value => Number.isInteger(value) && value >= 0 && value <= 100));
  assert.equal(WEATHER_DATA.radarFrames.length, 7);
  WEATHER_DATA.radarFrames.forEach(frame => frame.cells.forEach(cell => {
    assert.ok(cell.x >= 0 && cell.x <= 1);
    assert.ok(cell.y >= 0 && cell.y <= 1);
    assert.ok(cell.radius > 0 && cell.radius <= 1);
    assert.ok(cell.intensity >= 0 && cell.intensity <= 1);
  }));
  assert.match(html, /Bukan radar live/);
  assert.match(html, /MinuteCast di halaman ini adalah visualisasi lokal/);
});

test('all requested features have matching tabs, panels, and safe official reference links', () => {
  const tabs = ['harian', 'radar', 'minute-cast', 'bulanan', 'udara', 'aktivitas'];
  tabs.forEach(tab => {
    assert.match(html, new RegExp('data-tab="' + tab + '"'));
    assert.match(html, new RegExp('id="tab-' + tab + '"'));
  });
  for (const slug of ['10-day-weather-forecast', 'weather-radar', 'minute-weather-forecast', 'october-weather', 'air-quality-index', 'health-activities']) {
    assert.ok(html.includes(slug), 'missing AccuWeather reference: ' + slug);
  }
  const externalLinks = html.match(/<a\b[^>]*target="_blank"[^>]*>/g) || [];
  assert.ok(externalLinks.length > 0);
  externalLinks.forEach(link => assert.match(link, /rel="noopener noreferrer"/));
});
