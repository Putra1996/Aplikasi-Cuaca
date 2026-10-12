/**
 * CuacaKu — UI, state, rendering, and interaction handlers.
 * OpenWeather data is fetched from the same-origin server proxy; local sample data is only an explicitly labelled offline fallback.
 */
(function () {
  'use strict';

  var UNIT_STORAGE_KEY = 'cuacaku-temperature-unit';
  var MONTH_KEY = WEATHER_DATA.monthlyMonth.year + '-' + String(WEATHER_DATA.monthlyMonth.month).padStart(2, '0');
  var state = {
    isCelsius: readSavedUnit(),
    currentTab: 'beranda',
    hourlyDay: 'today',
    minuteWindow: 30,
    monthChartMode: 'temperature',
    monthKey: MONTH_KEY
  };
  window._currentMonthlyChartMode = state.monthChartMode;

  var ICONS = {
    '1': '☀️', '2': '🌤️', '3': '⛅', '4': '🌤️', '5': '🌫️', '6': '☁️', '7': '☁️', '8': '☁️',
    '11': '🌫️', '12': '🌧️', '13': '🌦️', '14': '🌦️', '15': '⛈️', '16': '🌩️', '17': '⛈️', '18': '🌧️',
    '19': '🌨️', '20': '🌨️', '21': '❄️', '22': '❄️', '23': '🌨️', '24': '🧊', '25': '🌨️', '26': '🌧️',
    '29': '🌧️', '30': '🔥', '31': '🥶', '32': '💨', '33': '🌙', '34': '🌤️', '35': '🌥️', '36': '⛅',
    '37': '🌫️', '38': '☁️', '39': '🌦️', '40': '🌧️', '41': '⛈️', '42': '🌩️', '43': '🌧️', '44': '🌨️'
  };

  function readSavedUnit() {
    try {
      return window.localStorage.getItem(UNIT_STORAGE_KEY) !== 'F';
    } catch (error) {
      return true;
    }
  }

  function saveUnit() {
    try {
      window.localStorage.setItem(UNIT_STORAGE_KEY, state.isCelsius ? 'C' : 'F');
    } catch (error) {
      // Storage can be disabled; the in-memory toggle still works.
    }
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function formatTemp(fahrenheit, withUnit) {
    if (fahrenheit == null || fahrenheit === '' || !Number.isFinite(Number(fahrenheit))) return '—';
    var value = state.isCelsius ? WEATHER_DATA.toCelsius(Number(fahrenheit)) : Math.round(Number(fahrenheit));
    return value + '°' + (withUnit === false ? '' : (state.isCelsius ? 'C' : 'F'));
  }

  function temperatureValue(fahrenheit) {
    return state.isCelsius ? WEATHER_DATA.toCelsius(fahrenheit) : Math.round(fahrenheit);
  }

  function getWeatherIcon(code) {
    var normalized = String(code == null ? '' : code).toLowerCase();
    var openWeatherIcons = {
      '01d': '☀️', '01n': '🌙', '02d': '🌤️', '02n': '☁️', '03d': '⛅', '03n': '☁️',
      '04d': '☁️', '04n': '☁️', '09d': '🌧️', '09n': '🌧️', '10d': '🌦️', '10n': '🌧️',
      '11d': '⛈️', '11n': '⛈️', '13d': '❄️', '13n': '❄️', '50d': '🌫️', '50n': '🌫️'
    };
    if (openWeatherIcons[normalized]) return openWeatherIcons[normalized];
    var match = normalized.match(/(\d{1,2})(?:\.svg)?$/);
    return ICONS[match ? String(Number(match[1])) : ''] || '🌤️';
  }

  function iconMarkup(code, label, className) {
    return '<span class="weather-emoji ' + escapeHTML(className || '') + '" role="img" aria-label="' + escapeHTML(label || 'Ikon cuaca') + '">' + getWeatherIcon(code) + '</span>';
  }

  function parseISODate(value) {
    return new Date(String(value) + 'T00:00:00Z');
  }

  function formatWeekday(value, style) {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: style || 'long',
      timeZone: 'UTC'
    }).format(parseISODate(value));
  }

  function formatDate(value, options) {
    return new Intl.DateTimeFormat('id-ID', Object.assign({
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    }, options || {})).format(parseISODate(value));
  }

  function formatMonthKey(value) {
    var parts = String(value).split('-');
    var date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, 1));
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  }

  function formatLocalClock(date) {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta'
    }).format(date);
  }

  function jakartaDateKey(date) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta'
    }).formatToParts(date);
    var values = {};
    parts.forEach(function (part) { if (part.type !== 'literal') values[part.type] = part.value; });
    return values.year + '-' + values.month + '-' + values.day;
  }

  function currentDateString() {
    return WEATHER_DATA.current.date || WEATHER_DATA.meta.snapshotDate;
  }

  function getAqiInfo(value) {
    if (value == null || value === '' || !Number.isFinite(Number(value))) return { label: 'Tidak tersedia', color: '#64748b', summary: 'Kualitas udara tidak tersedia', advice: 'Periksa sumber pemantauan resmi sebelum beraktivitas.' };
    value = Number(value);
    if (WEATHER_DATA.airQuality.scale === 'OpenWeather AQI') {
      var categories = {
        1: { label: 'Baik', color: '#22c55e', summary: 'Kualitas udara baik', advice: 'Kualitas udara baik; aktivitas luar ruang umumnya dapat dilakukan.' },
        2: { label: 'Cukup', color: '#84cc16', summary: 'Kualitas udara cukup', advice: 'Kelompok sensitif sebaiknya memperhatikan gejala saat terpapar lama.' },
        3: { label: 'Sedang', color: '#f59e0b', summary: 'Kualitas udara sedang', advice: 'Kelompok sensitif sebaiknya membatasi aktivitas luar ruang yang berat.' },
        4: { label: 'Buruk', color: '#f97316', summary: 'Kualitas udara buruk', advice: 'Kurangi aktivitas luar ruang, terutama bagi kelompok sensitif.' },
        5: { label: 'Sangat Buruk', color: '#ef4444', summary: 'Kualitas udara sangat buruk', advice: 'Batasi paparan luar ruang dan ikuti anjuran otoritas kesehatan setempat.' }
      };
      return categories[Math.max(1, Math.min(5, Math.round(value)))];
    }
    if (value <= 19) return { label: 'Bagus Sekali', color: '#22c55e', summary: 'Kualitas udara bagus sekali', advice: 'Kualitas udara ideal bagi sebagian besar orang; tetap perhatikan kondisi diri.' };
    if (value <= 49) return { label: 'Lumayan', color: '#84cc16', summary: 'Kualitas udara lumayan', advice: 'Umumnya dapat diterima; kelompok sensitif dapat mengalami gejala ringan jika terpapar lama.' };
    if (value <= 99) return { label: 'Buruk', color: '#f59e0b', summary: 'Kualitas udara buruk', advice: 'Kelompok sensitif sebaiknya mengurangi waktu di luar bila mengalami gejala.' };
    if (value <= 149) return { label: 'Tidak Sehat', color: '#f97316', summary: 'Kualitas udara tidak sehat', advice: 'Batasi aktivitas luar ruang, terutama bagi kelompok sensitif.' };
    if (value <= 249) return { label: 'Sangat Tidak Sehat', color: '#ef4444', summary: 'Kualitas udara sangat tidak sehat', advice: WEATHER_DATA.airQuality.advice };
    return { label: 'Berbahaya', color: '#a855f7', summary: 'Kualitas udara berbahaya', advice: 'Hindari kegiatan luar ruang dan ikuti arahan otoritas setempat.' };
  }

  function airQualityIsUnhealthy() {
    var value = Number(WEATHER_DATA.airQuality.index);
    if (!Number.isFinite(value)) return false;
    return WEATHER_DATA.airQuality.scale === 'OpenWeather AQI' ? value >= 4 : value >= 150;
  }

  function scoreLabel(score) {
    if (score >= 75) return 'Mendukung';
    if (score >= 55) return 'Cukup';
    if (score >= 35) return 'Kurang mendukung';
    return 'Tidak disarankan';
  }

  function getActivityScores() {
    var current = WEATHER_DATA.current;
    var feelsLikeC = WEATHER_DATA.toCelsius(current.feelsLike);
    var heatPenalty = Math.max(0, feelsLikeC - 27) * 3.2;
    var uvAvailable = Number.isFinite(current.uvIndex);
    var uv = uvAvailable ? current.uvIndex : 0;
    // Missing UV is not treated as safe: apply a conservative penalty and disclose the gap.
    var missingUvPenalty = uvAvailable ? 0 : 12;
    var rain = Number(current.rainChance) || 0;
    var aqiValue = Number(WEATHER_DATA.airQuality.index);
    var aqiPenalty = WEATHER_DATA.airQuality.scale === 'OpenWeather AQI'
      ? ({ 1: 0, 2: 6, 3: 18, 4: 34, 5: 52 }[Math.round(aqiValue)] || 0)
      : Math.max(0, aqiValue - 50) * 0.35;
    var aqiUnhealthy = airQualityIsUnhealthy();
    var wind = Number(current.wind.speed) || 0;
    var scores = [
      { id: 'walk', title: 'Jalan santai', icon: '🚶', bestTime: aqiUnhealthy ? 'Kurangi aktivitas luar ruang; cek kualitas udara terbaru.' : 'Pilih waktu yang teduh dan cukup minum.', score: 100 - heatPenalty * 0.6 - uv * 2.5 - aqiPenalty - rain * 0.14 - missingUvPenalty, details: 'Skor heuristik berdasarkan cuaca dan AQI yang tersedia; UV yang hilang diberi penalti konservatif.' },
      { id: 'run', title: 'Berlari', icon: '🏃', bestTime: aqiUnhealthy ? 'Tunda; pilih olahraga di dalam ruang.' : 'Sesuaikan intensitas dengan kondisi tubuh.', score: 100 - heatPenalty * 1.1 - uv * 4 - aqiPenalty * 1.2 - rain * 0.14 - missingUvPenalty, details: 'AQI dan panas diperhitungkan. Ini bukan penilaian medis.' },
      { id: 'cycling', title: 'Bersepeda', icon: '🚴', bestTime: aqiUnhealthy ? 'Kurangi perjalanan luar ruang bila memungkinkan.' : 'Periksa cuaca dan kondisi rute sebelum berangkat.', score: 100 - heatPenalty * 0.9 - uv * 3 - aqiPenalty - rain * 0.16 - missingUvPenalty, details: 'Perhitungkan AQI, hujan, cuaca, dan data UV yang tersedia.' },
      { id: 'fishing', title: 'Memancing', icon: '🎣', bestTime: aqiUnhealthy ? 'Batasi paparan luar ruang sampai kualitas udara membaik.' : 'Periksa hujan, angin, dan paparan UV.', score: 100 - heatPenalty * 0.45 - uv * 2.8 - aqiPenalty - rain * 0.07 - wind * 0.8 - missingUvPenalty, details: 'Skor memperhitungkan AQI, hujan, angin, panas, dan keterbatasan data UV.' }
    ];
    return scores.map(function (item) {
      item.score = Math.max(0, Math.min(100, Math.round(item.score)));
      item.rating = scoreLabel(item.score);
      return item;
    });
  }

  function syncUnitButtons() {
    var unit = state.isCelsius ? '°C' : '°F';
    var target = state.isCelsius ? 'Fahrenheit' : 'Celsius';
    $all('.btn-unit').forEach(function (button) {
      button.textContent = unit;
      button.setAttribute('aria-label', 'Satuan suhu ' + unit + '. Tekan untuk beralih ke ' + target + '.');
      button.title = 'Sekarang ' + unit + ' · tekan untuk beralih ke ' + target;
      button.classList.toggle('active', state.isCelsius);
      button.setAttribute('aria-pressed', state.isCelsius ? 'true' : 'false');
    });
  }

  function updateCurrentWeather() {
    var current = WEATHER_DATA.current;
    var locationName = $('#location-name');
    if (locationName) locationName.textContent = WEATHER_DATA.location.name + ', ' + WEATHER_DATA.location.region;
    var locationDetail = $('#location-detail');
    if (locationDetail) locationDetail.textContent = WEATHER_DATA.location.country + ' · ' + formatWeekday(currentDateString()) + ', ' + formatDate(currentDateString()) + ' · ' + (WEATHER_DATA.meta.live ? 'OpenWeather ' + current.observedAt : 'snapshot lokal ' + current.observedAt);

    var currentIcon = $('#current-icon');
    if (currentIcon) {
      currentIcon.textContent = getWeatherIcon(current.conditionCode);
      currentIcon.setAttribute('aria-label', current.condition);
    }
    var currentTemp = $('#current-temp');
    if (currentTemp) currentTemp.textContent = formatTemp(current.temp);
    var currentDesc = $('#current-desc');
    if (currentDesc) currentDesc.textContent = current.condition;
    var currentFeels = $('#current-feels');
    if (currentFeels) currentFeels.textContent = 'Terasa seperti ' + formatTemp(current.feelsLike);

    var airIndex = WEATHER_DATA.airQuality.index;
    var values = {
      'detail-high-low': formatTemp(current.high) + ' / ' + formatTemp(current.low),
      'detail-humidity': current.humidity == null ? 'Tidak tersedia' : current.humidity + '%',
      'detail-wind': (current.wind.speed == null ? '—' : current.wind.speed + ' km/j') + (current.wind.direction ? ' ' + current.wind.direction : '') + (current.wind.gust ? ' · gust ' + current.wind.gust + ' km/j' : ''),
      'detail-rain': current.rainChance == null ? 'Tidak tersedia' : current.rainChance + '%',
      'detail-visibility': current.visibility == null ? 'Tidak tersedia' : current.visibility + ' km',
      'detail-uv': current.uvIndex == null ? 'Tidak tersedia' : current.uvIndex + ' — ' + current.uvDesc,
      'detail-sunrise': current.sunrise || '—',
      'detail-sunset': current.sunset || '—',
      'detail-air': airIndex == null ? 'Tidak tersedia' : 'AQI ' + airIndex + ' · ' + getAqiInfo(airIndex).label
    };
    Object.keys(values).forEach(function (id) {
      var element = document.getElementById(id);
      if (element) element.textContent = values[id];
    });
  }

  function renderAlerts() {
    var container = $('#alerts-container');
    if (!container) return;
    var current = WEATHER_DATA.current;
    var aqi = WEATHER_DATA.airQuality;
    var aqiInfo = getAqiInfo(aqi.index);
    var alerts = [];
    if (airQualityIsUnhealthy()) {
      alerts.push({ icon: '🌫️', className: 'alert-danger', title: 'Kualitas udara ' + aqiInfo.label.toLowerCase(), text: (WEATHER_DATA.meta.live ? 'OpenWeather AQI ' : 'Snapshot lokal AQI ') + aqi.index + ' (' + aqiInfo.label + '). ' + aqiInfo.advice });
    }
    if (Number.isFinite(current.uvIndex) && current.uvIndex >= 8) {
      alerts.push({ icon: '☀️', className: 'alert-warning', title: 'Indeks UV sangat tinggi', text: 'Indeks UV mencapai ' + current.uvIndex + ' (' + String(current.uvDesc || '').toLowerCase() + '). Cari tempat teduh dan gunakan pelindung matahari.' });
    }
    if (Number.isFinite(Number(current.rainChance)) && Number(current.rainChance) >= 40) {
      alerts.push({ icon: '🌧️', className: 'alert-info', title: 'Ada peluang hujan', text: 'Peluang hujan ' + (current.rainWindow || 'pada interval berikutnya') + ' adalah ' + current.rainChance + '%. Periksa prakiraan terbaru sebelum bepergian.' });
    }
    if (!alerts.length) {
      alerts.push({ icon: 'ℹ️', className: 'alert-info', title: 'Tidak ada catatan khusus', text: WEATHER_DATA.meta.live ? 'Ringkasan dihitung dari data OpenWeather yang terakhir diterima ' + WEATHER_DATA.meta.snapshotLabel + '.' : 'Data OpenWeather belum terhubung; nilai yang tampil adalah fallback lokal dan bukan kondisi terkini.' });
    }
    container.innerHTML = alerts.map(function (alert) {
      return '<article class="alert-card ' + alert.className + '"><span class="alert-icon" aria-hidden="true">' + alert.icon + '</span><div class="alert-content"><h3>' + escapeHTML(alert.title) + '</h3><p>' + escapeHTML(alert.text) + '</p></div></article>';
    }).join('');
  }

  function renderFiveDayForecast() {
    var container = $('#forecast-5day');
    if (!container) return;
    container.innerHTML = WEATHER_DATA.dailyForecast.slice(0, 5).map(function (day, index) {
      var weekday = day.today ? 'Hari Ini' : formatWeekday(day.date, 'short');
      return '<article class="forecast-card ' + (day.today ? 'today' : '') + '">' +
        '<div class="forecast-day">' + escapeHTML(weekday) + '</div>' +
        '<div class="forecast-date">' + escapeHTML(formatDate(day.date, { day: 'numeric', month: 'short' })) + '</div>' +
        iconMarkup(day.icon, day.condition, 'forecast-icon') +
        '<div class="forecast-temps"><span class="forecast-high">' + formatTemp(day.high) + '</span><span class="forecast-low">' + formatTemp(day.low) + '</span></div>' +
        '<div class="forecast-condition">' + escapeHTML(day.condition) + '</div>' +
        '<div class="forecast-rain">💧 ' + (day.rainChance == null ? '—' : escapeHTML(day.rainChance) + '%') + '</div>' +
        '</article>';
    }).join('');
  }

  function renderDailyForecast() {
    var container = $('#daily-forecast-list');
    if (!container) return;
    var data = WEATHER_DATA.dailyForecast;
    var valid = data.filter(function (day) { return Number.isFinite(day.high) && Number.isFinite(day.low); });
    var allHighs = valid.map(function (day) { return day.high; });
    var allLows = valid.map(function (day) { return day.low; });
    var minTemp = allLows.length ? Math.min.apply(null, allLows) : 0;
    var maxTemp = allHighs.length ? Math.max.apply(null, allHighs) : 1;
    var range = Math.max(1, maxTemp - minTemp);

    container.innerHTML = data.map(function (day, index) {
      var hasTemps = Number.isFinite(day.high) && Number.isFinite(day.low);
      var barLeft = hasTemps ? ((day.low - minTemp) / range) * 100 : 0;
      var barWidth = hasTemps ? Math.max(0, ((day.high - day.low) / range) * 100) : 0;
      var dateText = formatDate(day.date, { day: 'numeric', month: 'short' });
      var detailValues = [
        ['Peluang hujan', day.rainChance == null ? '—' : day.rainChance + '%'],
        ['Kelembapan', day.humidity == null ? '—' : day.humidity + '%'],
        ['Angin', day.wind == null ? '—' : day.wind + ' km/j'],
        ['Indeks UV', day.uvIndex == null ? '—' : day.uvIndex]
      ];
      var details = detailValues.map(function (item) {
        return '<div><span>' + escapeHTML(item[0]) + '</span><strong>' + escapeHTML(item[1]) + '</strong></div>';
      }).join('');
      return '<details class="daily-item"' + (day.today || index === 0 ? ' open' : '') + '>' +
        '<summary class="daily-summary">' +
          '<span class="daily-date-col"><strong class="daily-day-name">' + escapeHTML(day.today ? 'Hari Ini' : formatWeekday(day.date)) + '</strong><span class="daily-date-text">' + escapeHTML(dateText) + '</span></span>' +
          iconMarkup(day.icon, day.condition, 'daily-icon') +
          '<span class="daily-condition">' + escapeHTML(day.condition) + '</span>' +
          '<span class="daily-high">' + (hasTemps ? formatTemp(day.high) : '—') + '</span>' +
          '<span class="daily-bar" aria-hidden="true"><span class="daily-bar-fill" style="margin-left:' + barLeft.toFixed(2) + '%;width:' + barWidth.toFixed(2) + '%"></span></span>' +
          '<span class="daily-low">' + (hasTemps ? formatTemp(day.low) : '—') + '</span>' +
          '<span class="daily-expand-label" aria-hidden="true">⌄</span>' +
        '</summary>' +
        '<div class="daily-details"><div class="daily-details-grid">' + details + '</div></div>' +
      '</details>';
    }).join('');
    var period = $('#daily-period');
    if (period && data.length) {
      var dayCount = data.length;
      var dailySource = WEATHER_DATA.provider && WEATHER_DATA.provider.modules && WEATHER_DATA.provider.modules.dailyForecast;
      var sourceLabel = WEATHER_DATA.meta.live ? (dailySource && dailySource.days >= 10 ? 'OpenWeather · hingga 10 hari' : 'OpenWeather · ' + dayCount + ' hari tersedia') : 'fallback lokal · bukan live';
      period.textContent = 'Klumprit, Jawa Tengah · ' + formatDate(data[0].date, { day: 'numeric', month: 'short' }) + '–' + formatDate(data[data.length - 1].date, { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + sourceLabel;
    }
  }

  function renderHourlyForecast(dayKey) {
    var container = $('#hourly-timeline');
    if (!container) return;
    var data = WEATHER_DATA.hourlyForecast[dayKey];
    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = '<p class="empty-inline">Data per jam belum tersedia.</p>';
      return;
    }
    container.innerHTML = data.map(function (hour, index) {
      var currentHour = dayKey === 'today' && jakartaDateKey(new Date()) === currentDateString() && hour.time.slice(0, 2) === new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }).format(new Date());
      return '<article class="hourly-item' + (currentHour ? ' current-hour' : '') + '">' +
        '<div class="hourly-time">' + escapeHTML(hour.time) + '</div>' +
        iconMarkup(hour.icon, hour.condition, 'hourly-icon') +
        '<div class="hourly-temp">' + formatTemp(hour.temp) + '</div>' +
        '<div class="hourly-condition">' + escapeHTML(hour.condition) + '</div>' +
        '<div class="hourly-rain">💧 ' + (hour.rain == null ? '—' : escapeHTML(hour.rain) + '%') + '</div>' +
        '<div class="hourly-extra">💦 ' + (hour.humidity == null ? '—' : escapeHTML(hour.humidity) + '%') + ' · 💨 ' + (hour.wind == null ? '—' : escapeHTML(hour.wind) + ' km/j') + '</div>' +
        '</article>';
    }).join('');
    $all('.hourly-tab').forEach(function (button) {
      var active = button.dataset.day === dayKey;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var hourlySubtitle = $('#hourly-subtitle');
    if (hourlySubtitle) {
      var step = WEATHER_DATA.provider && WEATHER_DATA.provider.modules && WEATHER_DATA.provider.modules.hourlyForecast && WEATHER_DATA.provider.modules.hourlyForecast.intervalMinutes;
      hourlySubtitle.textContent = 'Prakiraan per jam OpenWeather' + (step === 180 ? ' (interval 3 jam, 5 hari ke depan)' : step === 60 ? ' (interval 1 jam, 48 jam ke depan)' : '') + ' · kecepatan angin dikonversi ke km/j.';
    }
  }

  function renderMonthlySummary() {
    var available = WEATHER_DATA.monthlyData.filter(function (day) { return Number.isFinite(day.high) && Number.isFinite(day.low); });
    if (!available.length) return;
    var average = available.reduce(function (total, day) { return total + (day.high + day.low) / 2; }, 0) / available.length;
    var highs = available.map(function (day) { return day.high; });
    var lows = available.map(function (day) { return day.low; });
    var rainDays = available.filter(function (day) { return Number(day.rain) >= 40; }).length;
    var sunnyDays = available.filter(function (day) { return /cerah/i.test(day.condition); }).length;
    var monthLength = new Date(Date.UTC(WEATHER_DATA.monthlyMonth.year, WEATHER_DATA.monthlyMonth.month, 0)).getUTCDate();
    var values = {
      'summary-avg': formatTemp(average),
      'summary-max': formatTemp(Math.max.apply(null, highs)),
      'summary-min': formatTemp(Math.min.apply(null, lows)),
      'summary-rain-days': rainDays + ' hari',
      'summary-sunny-days': sunnyDays + ' hari',
      'summary-coverage': available.length + '/' + monthLength + ' hari'
    };
    Object.keys(values).forEach(function (id) {
      var element = document.getElementById(id);
      if (element) element.textContent = values[id];
    });
  }

  function renderMonthlyCalendar() {
    var container = $('#monthly-calendar');
    if (!container) return;
    var year = WEATHER_DATA.monthlyMonth.year;
    var month = WEATHER_DATA.monthlyMonth.month;
    var firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    var offset = (firstWeekday + 6) % 7;
    var monthLength = new Date(Date.UTC(year, month, 0)).getUTCDate();
    var dayData = {};
    WEATHER_DATA.monthlyData.forEach(function (item) { dayData[item.date] = item; });
    var headers = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    var html = headers.map(function (label) { return '<div class="cal-header" aria-hidden="true">' + label + '</div>'; }).join('');
    for (var blank = 0; blank < offset; blank++) html += '<div class="cal-day empty" aria-hidden="true"></div>';
    for (var number = 1; number <= monthLength; number++) {
      var item = dayData[number];
      var hasTemps = item && Number.isFinite(item.high) && Number.isFinite(item.low);
      var dateValue = year + '-' + String(month).padStart(2, '0') + '-' + String(number).padStart(2, '0');
      var label = formatWeekday(dateValue) + ', ' + number + ' ' + formatMonthKey(MONTH_KEY);
      var condition = item ? item.condition : 'Data belum tersedia';
      html += '<div class="cal-day' + (item && item.today ? ' today-cal' : '') + '" title="' + escapeHTML(label + ' · ' + condition) + '">' +
        '<span class="cal-day-num">' + number + '</span>' +
        (item && item.icon !== 'na' ? iconMarkup(item.icon, condition, 'cal-day-icon') : '<span class="cal-day-icon-placeholder" aria-hidden="true">—</span>') +
        '<span class="cal-day-temps">' + (hasTemps ? formatTemp(item.high, false) + ' / ' + formatTemp(item.low, false) : 'N/A') + '</span>' +
      '</div>';
    }
    container.innerHTML = html;
    var monthLabel = $('#calendar-month-label');
    if (monthLabel) monthLabel.textContent = formatMonthKey(MONTH_KEY);
  }

  function renderMonthlyTable() {
    var tbody = $('#monthly-table-body');
    if (!tbody) return;
    var year = WEATHER_DATA.monthlyMonth.year;
    var month = WEATHER_DATA.monthlyMonth.month;
    tbody.innerHTML = WEATHER_DATA.monthlyData.map(function (day) {
      var dateValue = year + '-' + String(month).padStart(2, '0') + '-' + String(day.date).padStart(2, '0');
      var hasTemps = Number.isFinite(day.high) && Number.isFinite(day.low);
      return '<tr' + (day.today ? ' class="today-row"' : '') + '>' +
        '<td><strong>' + day.date + ' ' + escapeHTML(formatMonthKey(MONTH_KEY)) + '</strong></td>' +
        '<td>' + escapeHTML(formatWeekday(dateValue)) + '</td>' +
        '<td><span class="table-condition">' + (day.icon === 'na' ? '<span class="table-weather-icon" aria-hidden="true">—</span>' : iconMarkup(day.icon, day.condition, 'table-weather-icon')) + '<span>' + escapeHTML(day.condition) + '</span></span></td>' +
        '<td>' + (hasTemps ? formatTemp(day.high) : 'N/A') + '</td>' +
        '<td>' + (hasTemps ? formatTemp(day.low) : 'N/A') + '</td>' +
        '<td>' + (day.rain == null ? 'N/A' : escapeHTML(day.rain) + '%') + '</td>' +
      '</tr>';
    }).join('');
  }

  function setMonthlyView(monthKey) {
    state.monthKey = monthKey || MONTH_KEY;
    var picker = $('#month-picker');
    if (picker && picker.value !== state.monthKey) picker.value = state.monthKey;
    var supported = state.monthKey === MONTH_KEY;
    var dataView = $('#monthly-data-view');
    var emptyView = $('#monthly-empty');
    var subtitle = $('#monthly-subtitle');
    if (dataView) dataView.classList.toggle('hidden', !supported);
    if (emptyView) emptyView.classList.toggle('hidden', supported);
    if (subtitle) subtitle.textContent = supported ? 'Kalender, ringkasan suhu, dan tren peluang hujan · data contoh Oktober 2026.' : 'Cuaca bulanan · ' + formatMonthKey(state.monthKey) + ' · dataset belum tersedia.';
    if (supported) {
      renderMonthlySummary();
      renderMonthlyCalendar();
      renderMonthlyTable();
      if (state.currentTab === 'bulanan') window.setTimeout(function () { if (window.drawMonthlyChart) window.drawMonthlyChart(state.monthChartMode); }, 50);
    }
  }

  function renderAirQuality() {
    var data = WEATHER_DATA.airQuality;
    var info = getAqiInfo(data.index);
    var scaleMax = data.scale === 'OpenWeather AQI' ? 5 : 300;
    var gauge = $('#aqi-gauge');
    if (gauge) {
      gauge.style.setProperty('--aqi-angle', Math.min(360, Math.max(0, Number(data.index) / scaleMax * 360)) + 'deg');
      gauge.style.setProperty('--aqi-color', info.color);
      gauge.setAttribute('aria-label', data.scale + (WEATHER_DATA.meta.live ? '' : ' snapshot') + ' ' + data.index + ', kategori ' + info.label + ', ' + (data.updatedAtLabel || WEATHER_DATA.meta.snapshotLabel));
    }
    var value = $('#aqi-value');
    var category = $('#aqi-category');
    var summary = $('#aqi-summary');
    var advice = $('#aqi-advice');
    var updatedAt = $('#aqi-updated');
    if (value) value.textContent = data.index == null ? '—' : data.index;
    if (updatedAt) updatedAt.textContent = data.updatedAtLabel || WEATHER_DATA.meta.snapshotLabel;
    if (category) category.textContent = info.label;
    if (summary) summary.textContent = info.summary;
    if (advice) advice.textContent = info.advice;
    var scaleTitle = $('#air-scale-title');
    if (scaleTitle) scaleTitle.textContent = data.scale === 'OpenWeather AQI' ? 'Rentang kategori AQI OpenWeather (1–5)' : 'Rentang kategori AQI AccuWeather';
    var tbody = $('#pollutant-table-body');
    if (tbody) tbody.innerHTML = (data.pollutants || []).map(function (pollutant) {
      return '<tr><td><strong>' + escapeHTML(pollutant.name) + '</strong><small class="pollutant-description">' + escapeHTML(pollutant.description) + '</small></td><td>' + (pollutant.value == null ? '—' : escapeHTML(pollutant.value) + ' ' + escapeHTML(pollutant.unit)) + '</td><td>' + (pollutant.index == null ? '—' : escapeHTML(pollutant.index)) + '</td><td>' + (pollutant.category == null ? '—' : escapeHTML(pollutant.category)) + '</td></tr>';
    }).join('') || '<tr><td colspan="4">Data polutan belum tersedia.</td></tr>';
  }

  function renderHealthActivities() {
    var current = WEATHER_DATA.current;
    var feelsLikeC = WEATHER_DATA.toCelsius(current.feelsLike);
    var uvAvailable = Number.isFinite(current.uvIndex);
    var uvLabel = !uvAvailable ? 'Tidak tersedia' : current.uvIndex >= 11 ? 'Ekstrem' : current.uvIndex >= 8 ? 'Sangat tinggi' : current.uvIndex >= 6 ? 'Tinggi' : current.uvIndex >= 3 ? 'Sedang' : 'Rendah';
    var heatLabel = feelsLikeC >= 35 ? 'Risiko panas tinggi' : feelsLikeC >= 32 ? 'Terasa panas' : feelsLikeC >= 28 ? 'Hangat' : 'Nyaman';
    var aqi = getAqiInfo(WEATHER_DATA.airQuality.index);
    var sourceName = WEATHER_DATA.meta.live ? 'OpenWeather' : 'fallback lokal';
    var risks = [
      { icon: '☀️', title: 'Paparan UV', value: uvAvailable ? current.uvIndex + ' · ' + uvLabel : 'Tidak tersedia', copy: uvAvailable ? (current.uvIndex >= 8 ? 'Cari tempat teduh dan gunakan perlindungan matahari.' : 'Tetap gunakan perlindungan saat beraktivitas di luar.') : 'UV tidak ditampilkan pada data ini; jangan anggap nilainya nol.' },
      { icon: '🌡️', title: 'Panas terasa', value: formatTemp(current.feelsLike) + ' · ' + heatLabel, copy: 'Suhu terasa dari ' + sourceName + ' pada ' + current.observedAt + '.' },
      { icon: '🌫️', title: 'Kualitas udara', value: 'AQI ' + WEATHER_DATA.airQuality.index + ' · ' + aqi.label, copy: (WEATHER_DATA.meta.live ? 'OpenWeather AQI' : 'Snapshot fallback') + '; kelompok sensitif sebaiknya membatasi aktivitas luar ruang bila tidak sehat.' },
      { icon: '🌧️', title: 'Peluang hujan', value: current.rainChance == null ? 'Tidak tersedia' : current.rainChance + '%', copy: 'Peluang presipitasi ' + (current.rainWindow || 'pada interval berikutnya') + ' menurut ' + sourceName + '.' }
    ];
    var riskGrid = $('#health-risk-grid');
    if (riskGrid) riskGrid.innerHTML = risks.map(function (risk) {
      return '<article class="health-risk-card"><span class="health-risk-icon" aria-hidden="true">' + risk.icon + '</span><div><span class="eyebrow">' + escapeHTML(risk.title) + '</span><strong>' + escapeHTML(risk.value) + '</strong><p>' + escapeHTML(risk.copy) + '</p></div></article>';
    }).join('');

    var activityGrid = $('#activity-grid');
    if (activityGrid) activityGrid.innerHTML = getActivityScores().map(function (activity) {
      return '<article class="activity-card"><div class="activity-card-top"><span class="activity-icon" aria-hidden="true">' + activity.icon + '</span><span class="activity-score-label">' + escapeHTML(activity.rating) + '</span></div>' +
        '<h3>' + escapeHTML(activity.title) + '</h3>' +
        '<div class="activity-score-row"><strong>' + activity.score + '</strong><span>/100</span><div class="activity-score-track" aria-label="Skor ' + activity.score + ' dari 100"><span style="width:' + activity.score + '%"></span></div></div>' +
        '<p class="activity-best-time">' + escapeHTML(activity.bestTime) + '</p><p class="activity-details">' + escapeHTML(activity.details) + '</p></article>';
    }).join('');
  }

  function renderComfortGauges() {
    var container = $('#comfort-grid');
    if (!container) return;
    var activities = getActivityScores();
    var colors = { walk: '#f59e0b', run: '#3b82f6', cycling: '#ef4444', fishing: '#22c55e' };
    container.innerHTML = activities.map(function (activity) {
      return '<article class="comfort-card"><div class="comfort-gauge" data-value="' + activity.score + '" data-color="' + colors[activity.id] + '"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" class="gauge-bg"></circle><circle cx="50" cy="50" r="45" class="gauge-fill"></circle></svg><span class="comfort-val">' + activity.score + '</span></div><span class="comfort-label">' + escapeHTML(activity.title) + '</span><small class="comfort-rating">' + escapeHTML(activity.rating) + '</small></article>';
    }).join('');
    animateComfortGauges();
  }

  function animateComfortGauges() {
    $all('.comfort-gauge').forEach(function (gauge) {
      var value = Math.max(0, Math.min(100, Number(gauge.dataset.value) || 0));
      var color = gauge.dataset.color || '#3b82f6';
      var circumference = 2 * Math.PI * 45;
      var fill = gauge.querySelector('.gauge-fill');
      if (!fill) return;
      fill.style.stroke = color;
      fill.style.strokeDasharray = circumference;
      fill.style.strokeDashoffset = circumference - (value / 100) * circumference;
    });
  }

  function renderMinuteCast() {
    var data = WEATHER_DATA.minuteCast;
    var values = data.precipitationProbability || [];
    var step = Number(data.intervalMinutes) || 5;
    var isLiveMinute = Boolean(data.live) || Boolean(WEATHER_DATA.provider && WEATHER_DATA.provider.modules && WEATHER_DATA.provider.modules.minuteCast && WEATHER_DATA.provider.modules.minuteCast.live);
    var count = Math.min(values.length, Math.max(1, Math.round(state.minuteWindow / step)));
    var windowValues = values.slice(0, count);
    var peak = windowValues.length ? Math.max.apply(null, windowValues) : 0;
    var peakIndex = windowValues.indexOf(peak);
    var minuteOffset = (peakIndex + 1) * step;
    var title = $('#minute-summary-title');
    var copy = $('#minute-summary-copy');
    var peakValue = $('#minute-peak-value');
    var peakTime = $('#minute-peak-time');
    if (!values.length) {
      if (title) title.textContent = 'Prakiraan per menit belum tersedia';
      if (copy) copy.textContent = 'Endpoint OpenWeather 1-minute timeline belum dapat dimuat; aktifkan One Call API 4.0 untuk data 60 menit ke depan.';
      if (peakValue) peakValue.textContent = '—';
      if (peakTime) peakTime.textContent = 'belum tersedia';
    } else {
      if (title) title.textContent = (peak < 20 ? 'Peluang hujan rendah' : peak < 50 ? 'Peluang hujan meningkat' : 'Ada interval dengan peluang hujan tinggi') + (isLiveMinute ? '' : ' pada simulasi ini');
      if (copy) copy.textContent = 'Peluang tertinggi dalam ' + state.minuteWindow + ' menit ke depan diperkirakan sekitar ' + peak + '%. ' + (isLiveMinute ? 'Basis: prakiraan per menit OpenWeather One Call API 4.0.' : 'Ini pola contoh, bukan nowcast aktual.');
      if (peakValue) peakValue.textContent = peak + '%';
      if (peakTime) peakTime.textContent = 'sekitar +' + minuteOffset + ' menit';
    }
    var clock = $('#minute-clock');
    if (clock) clock.textContent = 'Waktu lokal saat dibuka · ' + formatLocalClock(new Date()) + ' WIB';
    var axisEnd = $('#minute-axis-end');
    if (axisEnd) axisEnd.textContent = '+' + state.minuteWindow + ' mnt';
    var chart = $('#minute-chart');
    if (chart) {
      chart.innerHTML = windowValues.map(function (chance, index) {
        var offset = (index + 1) * step;
        var tone = chance >= 60 ? 'high' : chance >= 30 ? 'medium' : 'low';
        return '<div class="minute-bar-column" role="listitem" aria-label="+' + offset + ' menit: peluang ' + chance + '%" title="+' + offset + ' menit · ' + chance + '%"><div class="minute-bar-track"><span class="minute-bar ' + tone + '" style="height:' + Math.max(3, chance) + '%"></span></div><span class="minute-bar-label">+' + offset + '′</span></div>';
      }).join('');
    }
    $all('.minute-window').forEach(function (button) {
      var active = Number(button.dataset.minuteWindow) === state.minuteWindow;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function redrawCurrentTab() {
    window.requestAnimationFrame(function () {
      if (state.currentTab === 'harian' && window.drawDailyChart) window.drawDailyChart();
      if (state.currentTab === 'per-jam' && window.drawHourlyChart) window.drawHourlyChart(state.hourlyDay);
      if (state.currentTab === 'bulanan' && window.drawMonthlyChart && state.monthKey === MONTH_KEY) window.drawMonthlyChart(state.monthChartMode);
      if (state.currentTab === 'radar' && window.drawRadar) window.drawRadar();
    });
  }

  function renderAll() {
    syncUnitButtons();
    updateCurrentWeather();
    renderAlerts();
    renderFiveDayForecast();
    renderDailyForecast();
    renderHourlyForecast(state.hourlyDay);
    renderMonthlySummary();
    renderMonthlyCalendar();
    renderMonthlyTable();
    setMonthlyView(state.monthKey);
    renderAirQuality();
    renderHealthActivities();
    renderComfortGauges();
    renderMinuteCast();
    updateDataNotice();
    redrawCurrentTab();
  }

  function switchTab(tabName) {
    var target = document.getElementById('tab-' + tabName);
    if (!target) return;
    state.currentTab = tabName;
    $all('.nav-tab[data-tab]').forEach(function (button) {
      var active = button.dataset.tab === tabName;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    $all('.tab-content').forEach(function (panel) {
      var active = panel === target;
      panel.classList.toggle('active', active);
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    closeMobileNavigation();
    if (tabName === 'radar' && window.drawRadar) window.drawRadar();
    redrawCurrentTab();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setupNavigation() {
    document.addEventListener('click', function (event) {
      var tabButton = event.target.closest('[data-tab]');
      if (tabButton) switchTab(tabButton.dataset.tab);
    });
  }

  function setupUnitToggle() {
    $all('.btn-unit').forEach(function (button) {
      button.addEventListener('click', function () {
        state.isCelsius = !state.isCelsius;
        saveUnit();
        renderAll();
      });
    });
  }

  function setupRefresh() {
    $all('.btn-refresh').forEach(function (button) {
      button.addEventListener('click', function () {
        button.classList.remove('refreshing');
        void button.offsetWidth;
        button.classList.add('refreshing');
        var status = $('#refresh-status');
        if (status) status.textContent = 'Memuat data terbaru dari OpenWeather…';
        loadLiveData().then(function (loaded) {
          renderAll();
          if (status) status.textContent = loaded
            ? 'Data OpenWeather diperbarui ' + WEATHER_DATA.meta.snapshotLabel + '.'
            : 'OpenWeather tidak dapat dihubungi; menampilkan data terakhir yang tersedia.';
        });
      });
    });
  }

  function setupHamburger() {
    var hamburger = $('#hamburger');
    var mobileNav = $('#mobile-nav');
    if (!hamburger || !mobileNav) return;
    hamburger.addEventListener('click', function () {
      var isOpen = !mobileNav.classList.contains('hidden');
      mobileNav.classList.toggle('hidden', isOpen);
      hamburger.classList.toggle('active', !isOpen);
      hamburger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      hamburger.setAttribute('aria-label', isOpen ? 'Buka menu' : 'Tutup menu');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMobileNavigation();
    });
  }

  function closeMobileNavigation() {
    var mobileNav = $('#mobile-nav');
    var hamburger = $('#hamburger');
    if (!mobileNav || !hamburger) return;
    mobileNav.classList.add('hidden');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Buka menu');
  }

  function setupHourlyTabs() {
    $all('.hourly-tab').forEach(function (button) {
      button.addEventListener('click', function () {
        state.hourlyDay = button.dataset.day === 'tomorrow' ? 'tomorrow' : 'today';
        window._currentHourlyDay = state.hourlyDay;
        renderHourlyForecast(state.hourlyDay);
        if (window.drawHourlyChart) window.drawHourlyChart(state.hourlyDay);
      });
    });
    window._currentHourlyDay = state.hourlyDay;
  }

  function setupMinuteCast() {
    $all('.minute-window').forEach(function (button) {
      button.addEventListener('click', function () {
        state.minuteWindow = Number(button.dataset.minuteWindow) || 30;
        renderMinuteCast();
      });
    });
  }

  function setupMonthlyControls() {
    var picker = $('#month-picker');
    if (picker) picker.addEventListener('change', function () {
      if (/^\d{4}-\d{2}$/.test(picker.value)) setMonthlyView(picker.value);
    });
    var reset = $('#month-reset');
    if (reset) reset.addEventListener('click', function () { setMonthlyView(MONTH_KEY); });
    $all('.month-chart-mode').forEach(function (button) {
      button.addEventListener('click', function () {
        state.monthChartMode = button.dataset.chartMode === 'rain' ? 'rain' : 'temperature';
        window._currentMonthlyChartMode = state.monthChartMode;
        $all('.month-chart-mode').forEach(function (option) {
          var active = option === button;
          option.classList.toggle('active', active);
          option.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        if (window.drawMonthlyChart && state.monthKey === MONTH_KEY) window.drawMonthlyChart(state.monthChartMode);
      });
    });
  }

  function hideLoadingScreen() {
    var loading = $('#loading-screen');
    var app = $('#app');
    if (app) app.classList.remove('hidden');
    if (loading) {
      loading.classList.add('fade-out');
      window.setTimeout(function () { loading.style.display = 'none'; }, 350);
    }
  }

  function setModuleStatus() {
    var modules = WEATHER_DATA.provider && WEATHER_DATA.provider.modules || {};
    var minuteBadge = $('#minute-data-badge');
    if (minuteBadge) {
      var minuteLive = Boolean(modules.minuteCast && modules.minuteCast.live);
      minuteBadge.textContent = minuteLive ? 'Live · One Call 4.0' : 'Simulasi';
      minuteBadge.classList.toggle('data-badge-demo', !minuteLive);
    }
    var monthlyBadge = $('#monthly-data-badge');
    if (monthlyBadge) monthlyBadge.textContent = modules.monthly && modules.monthly.live ? 'Live' : 'Data contoh';
  }

  function updateDataNotice() {
    var noticeText = $('#data-notice-text');
    var noticeLink = $('#data-notice-link');
    var footerNote = $('#footer-data-note');
    var refreshStatus = $('#refresh-status');
    if (WEATHER_DATA.meta.live) {
      if (noticeText) noticeText.innerHTML = '<strong>Terhubung OpenWeather.</strong> Cuaca, prakiraan, per jam, menit, dan AQI diambil melalui proxy server CuacaKu (' + escapeHTML(WEATHER_DATA.meta.snapshotLabel) + '). Polling otomatis kira-kira setiap ' + Math.round((WEATHER_DATA.provider && WEATHER_DATA.provider.refreshIntervalSeconds || 600) / 60) + ' menit — bukan setiap detik. Radar tetap simulasi.';
      if (noticeLink) {
        noticeLink.textContent = 'Status sumber ↗';
        noticeLink.setAttribute('href', 'api/health');
        noticeLink.removeAttribute('target');
        noticeLink.removeAttribute('rel');
      }
      if (footerNote) footerNote.textContent = 'Data cuaca OpenWeather via server CuacaKu (diperbarui ' + WEATHER_DATA.meta.snapshotLabel + ') · radar tetap simulasi · satu kalender bulanan berisi data contoh.';
    } else {
      if (noticeText) noticeText.innerHTML = '<strong>Data OpenWeather belum terhubung.</strong> Nilai yang tampil adalah fallback lokal yang ditandai jelas, bukan kondisi terkini. Jalankan server dengan <code>OPENWEATHER_API_KEY</code> untuk sinkronisasi live. Radar tetap simulasi.';
      if (noticeLink) {
        noticeLink.textContent = 'Cara mengaktifkan ↗';
        noticeLink.setAttribute('href', 'https://openweathermap.org/api');
        noticeLink.setAttribute('target', '_blank');
        noticeLink.setAttribute('rel', 'noopener noreferrer');
      }
      if (footerNote) footerNote.textContent = 'Fallback lokal (bukan live) · jalankan server.js dengan OPENWEATHER_API_KEY untuk data OpenWeather · radar simulasi.';
    }
    if (refreshStatus) refreshStatus.textContent = WEATHER_DATA.meta.live ? 'Data OpenWeather diperbarui ' + WEATHER_DATA.meta.snapshotLabel + '.' : 'OpenWeather belum terhubung; menampilkan fallback lokal.';
    setModuleStatus();
  }

  function mergeLivePayload(payload) {
    if (!payload || typeof payload !== 'object' || !payload.meta) return false;
    ['meta', 'provider', 'location', 'current', 'dailyForecast', 'hourlyForecast', 'minuteCast', 'airQuality'].forEach(function (key) {
      if (payload[key] !== undefined) WEATHER_DATA[key] = payload[key];
    });
    return true;
  }

  function loadLiveData() {
    return fetch('api/weather', { headers: { accept: 'application/json' } }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) throw new Error('API ' + response.status);
        return body;
      });
    }).then(function (payload) {
      if (mergeLivePayload(payload)) renderAll();
      return true;
    }).catch(function () {
      updateDataNotice();
      return false;
    });
  }

  function init() {
    hideLoadingScreen();
    setupNavigation();
    setupUnitToggle();
    setupRefresh();
    setupHamburger();
    setupHourlyTabs();
    setupMinuteCast();
    setupMonthlyControls();
    renderAll();
    updateDataNotice();
    loadLiveData();
  }

  // Canvas modules use these public helpers so chart labels share the same unit state.
  window.isCelsius = function () { return state.isCelsius; };
  window.tempVal = temperatureValue;
  window.temp = formatTemp;
  window.weatherUnit = function () { return state.isCelsius ? '°C' : '°F'; };
  window.currentWeatherTab = function () { return state.currentTab; };
  window.WEATHER_UI = {
    switchTab: switchTab,
    getActivityScores: getActivityScores,
    formatTemp: formatTemp,
    renderAll: renderAll
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
