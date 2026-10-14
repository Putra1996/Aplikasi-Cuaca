/**
 * Sekitarku x CuacaKu — Modul Integrasi Nasional 500+ Kota Indonesia, GPS Real-Time,
 * API BMKG (Auto-Gempa & Tsunami) + Open-Meteo (Cuaca, UV, US-EPA AQI 0-500),
 * Skor Lingkungan & Kesiapan Aktivitas Outdoor (Eco-Health 0-100),
 * Konversi Polusi Setara Rokok Pasif (Berkeley Earth Formula),
 * Status Gunung Api Terdekat (PVMBG/MAGMA), Pantauan Karhutla FDRS & Kabut Asap,
 * Generator Kartu Infografis 9:16 HD (IG/WA Story), dan PWA Service Worker.
 */
(function () {
  'use strict';

  var DATA = window.SEKITARKU_DATA;
  if (!DATA) return;

  var CACHE_PREFIX = 'sekitarku_cache_v2_';
  var CITY_STORAGE_KEY = 'cuacaku-sekitarku-selected-city';
  var DEFAULT_TTL_MS = 15 * 60 * 1000;
  var memoryCache = new Map();

  var apiCache = {
    get: function (key) {
      var mem = memoryCache.get(key);
      if (mem) {
        if (Date.now() < mem.expiry) return mem.data;
        memoryCache.delete(key);
      }
      try {
        var raw = window.localStorage.getItem(CACHE_PREFIX + key);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && Date.now() < parsed.expiry) {
            memoryCache.set(key, parsed);
            return parsed.data;
          }
          window.localStorage.removeItem(CACHE_PREFIX + key);
        }
      } catch (e) {}
      return null;
    },
    set: function (key, data, ttlMs) {
      if (!data) return;
      var item = {
        data: data,
        expiry: Date.now() + (ttlMs || DEFAULT_TTL_MS),
        cachedAt: new Date().toISOString()
      };
      memoryCache.set(key, item);
      try {
        window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
      } catch (e) {}
    }
  };

  var state = {
    location: loadSavedCity(),
    isGps: false,
    gpsLoading: false,
    bundle: null,
    loading: false,
    citySearchTerm: '',
    cityRegionFilter: 'Semua',
    volcanoSearchTerm: '',
    volcanoRegionFilter: 'Semua',
    volcanoStatusFilter: 'ALL',
    karhutlaSearchTerm: '',
    karhutlaIslandFilter: 'Semua',
    emergencyTab: 'kontak',
    showRecentQuakes: false,
    deferredPwaPrompt: null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
    shareDataUrl: null
  };

  function loadSavedCity() {
    try {
      var params = new URLSearchParams(window.location.search);
      var cityParam = params.get('city');
      if (cityParam) {
        var matched = DATA.findCityByName(cityParam);
        if (matched) return matched;
      }
      var raw = window.localStorage.getItem(CITY_STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.name && Number.isFinite(Number(saved.lat)) && Number.isFinite(Number(saved.lon))) {
          return saved;
        }
      }
    } catch (e) {}
    return DATA.INDONESIA_CITIES[0] || {
      name: 'Klumprit',
      province: 'Jawa Tengah',
      region: 'Jawa',
      lat: -7.42,
      lon: 109.24
    };
  }

  function saveSelectedCity(city) {
    try {
      window.localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify(city));
    } catch (e) {}
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function formatTempC(tempC) {
    var valC = Number(tempC);
    if (!Number.isFinite(valC)) return '—';
    if (typeof window.isCelsius === 'function' && !window.isCelsius()) {
      return Math.round(valC * 9 / 5 + 32) + '°F';
    }
    return Math.round(valC) + '°C';
  }

  function buildLocationQuery(loc) {
    var p = new URLSearchParams();
    p.set('lat', String(loc.lat));
    p.set('lon', String(loc.lon));
    p.set('name', loc.name || 'Klumprit');
    p.set('province', loc.province || loc.region || 'Jawa Tengah');
    p.set('region', loc.province || loc.region || 'Jawa Tengah');
    return '?' + p.toString();
  }

  /**
   * Ambil data Sekitarku: prioritas ke /api/sekitarku (server proxy BMKG + Open-Meteo),
   * lalu fallback fetch langsung ke Open-Meteo & BMKG dari browser, dan terakhir fallback deterministik.
   */
  function fetchSekitarkuData(loc, forceRefresh) {
    var safeLat = Number(loc && loc.lat) || -7.42;
    var safeLon = Number(loc && loc.lon) || 109.24;
    var cacheKey = 'bundle_' + safeLat.toFixed(3) + '_' + safeLon.toFixed(3);

    if (!forceRefresh) {
      var cached = apiCache.get(cacheKey);
      if (cached) {
        cached.location = Object.assign({}, cached.location, {
          name: loc.name,
          province: loc.province || loc.region || 'Indonesia',
          region: loc.region || 'Indonesia',
          lat: safeLat,
          lon: safeLon
        });
        return Promise.resolve(cached);
      }
    }

    var query = buildLocationQuery(loc) + (forceRefresh ? '&force=1' : '');
    return fetch('api/sekitarku' + query, { headers: { accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('API sekitarku ' + res.status);
        return res.json();
      })
      .then(function (bundle) {
        if (bundle && bundle.ecoHealth) {
          apiCache.set(cacheKey, bundle, DEFAULT_TTL_MS);
          return bundle;
        }
        throw new Error('Invalid bundle');
      })
      .catch(function () {
        return fetchDirectFromOpenMeteoAndBmkg(loc);
      });
  }

  function fetchDirectFromOpenMeteoAndBmkg(loc) {
    var safeLat = Number(loc && loc.lat) || -7.42;
    var safeLon = Number(loc && loc.lon) || 109.24;
    var weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + safeLat + '&longitude=' + safeLon +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,uv_index,cloud_cover,is_day' +
      '&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,uv_index,cloud_cover,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=auto&models=best_match&forecast_days=7';
    var aqiUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + safeLat + '&longitude=' + safeLon +
      '&current=us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust&hourly=us_aqi,pm2_5,pm10,carbon_monoxide,ozone&timezone=auto&forecast_days=3';
    var bmkgUrl = 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json';

    return Promise.allSettled([
      fetch(weatherUrl, { headers: { accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }),
      fetch(aqiUrl, { headers: { accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }),
      fetch(bmkgUrl, { headers: { accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; })
    ]).then(function (results) {
      var wRaw = results[0].status === 'fulfilled' ? results[0].value : null;
      var aRaw = results[1].status === 'fulfilled' ? results[1].value : null;
      var bRaw = results[2].status === 'fulfilled' ? results[2].value : null;

      var temp = wRaw && wRaw.current && wRaw.current.temperature_2m != null ? Math.round(wRaw.current.temperature_2m) : 28;
      var feelsLike = wRaw && wRaw.current && wRaw.current.apparent_temperature != null ? Math.round(wRaw.current.apparent_temperature) : 31;
      var humidity = wRaw && wRaw.current && wRaw.current.relative_humidity_2m != null ? Math.round(wRaw.current.relative_humidity_2m) : 76;
      var precip = wRaw && wRaw.current && wRaw.current.precipitation != null ? Number(wRaw.current.precipitation) : 0;
      var clouds = wRaw && wRaw.current && wRaw.current.cloud_cover != null ? Number(wRaw.current.cloud_cover) : 48;
      var rawCode = wRaw && wRaw.current && wRaw.current.weather_code != null ? Number(wRaw.current.weather_code) : 2;
      var code = DATA.calibrateWeatherCode({ weatherCode: rawCode, precipitation: precip, cloudCover: clouds });
      var uvIndex = wRaw && wRaw.current && wRaw.current.uv_index != null ? Math.round(wRaw.current.uv_index * 10) / 10 : 5;
      var windSpeed = wRaw && wRaw.current && wRaw.current.wind_speed_10m != null ? Math.round(wRaw.current.wind_speed_10m) : 12;
      var pressure = wRaw && wRaw.current && wRaw.current.surface_pressure != null ? Math.round(wRaw.current.surface_pressure) : 1010;

      var aqi = aRaw && aRaw.current && aRaw.current.us_aqi != null ? Math.round(aRaw.current.us_aqi) : 45;
      var pm25 = aRaw && aRaw.current && aRaw.current.pm2_5 != null ? Math.round(aRaw.current.pm2_5 * 10) / 10 : 12.5;
      var pm10 = aRaw && aRaw.current && aRaw.current.pm10 != null ? Math.round(aRaw.current.pm10 * 10) / 10 : 22.0;
      var co = aRaw && aRaw.current && aRaw.current.carbon_monoxide != null ? Math.round(aRaw.current.carbon_monoxide) : 280;
      var no2 = aRaw && aRaw.current && aRaw.current.nitrogen_dioxide != null ? Math.round(aRaw.current.nitrogen_dioxide * 10) / 10 : 8.5;
      var so2 = aRaw && aRaw.current && aRaw.current.sulphur_dioxide != null ? Math.round(aRaw.current.sulphur_dioxide * 10) / 10 : 4.2;
      var o3 = aRaw && aRaw.current && aRaw.current.ozone != null ? Math.round(aRaw.current.ozone * 10) / 10 : 25.0;
      var dust = aRaw && aRaw.current && aRaw.current.dust != null ? Math.round(aRaw.current.dust * 10) / 10 : 8.0;

      var g = bRaw && bRaw.Infogempa && bRaw.Infogempa.gempa;
      var coords = g && g.Coordinates ? String(g.Coordinates).split(',') : ['-7.92', '110.42'];
      var qLat = parseFloat(coords[0]) || -7.92;
      var qLon = parseFloat(coords[1]) || 110.42;
      var latestQuake = {
        live: Boolean(g),
        date: (g && g.Tanggal) || '14 Okt 2026',
        time: (g && g.Jam) || '09:15:20 WIB',
        lat: qLat,
        lon: qLon,
        magnitude: g ? parseFloat(g.Magnitude) || 4.2 : 4.2,
        depth: (g && g.Kedalaman) || '14 km',
        wilayah: (g && g.Wilayah) || 'Pusat gempa berada di darat 18 km BaratDaya Gunungkidul, D.I. Yogyakarta',
        potensi: (g && g.Potensi) || 'Tidak berpotensi tsunami',
        dirasakan: (g && g.Dirasakan) || 'II-III Bantul, II Gunungkidul',
        shakemap: g && g.Shakemap ? 'https://data.bmkg.go.id/DataMKG/TEWS/' + g.Shakemap : null,
        distanceKm: DATA.calculateDistance(safeLat, safeLon, qLat, qLon)
      };

      var weatherObj = {
        live: Boolean(wRaw),
        current: {
          temp: temp,
          feelsLike: feelsLike,
          humidity: humidity,
          precipitation: precip,
          cloudCover: clouds,
          weatherCode: code,
          windSpeed: windSpeed,
          uvIndex: uvIndex,
          pressure: pressure
        }
      };

      var ecoHealth = DATA.calculateEcoHealthScore(aqi, temp, humidity, uvIndex, pm25);
      var volcanoes = DATA.getNearbyVolcanoes(safeLat, safeLon, 250);
      var fdrs = DATA.calculateFdrs(weatherObj);
      var hotspots = DATA.getNearbyHotspots(safeLat, safeLon, 400);
      var haze = DATA.getHazeStatus(hotspots.nearest, aqi, pm25);

      return {
        meta: {
          app: 'CuacaKu x Sekitarku',
          live: Boolean(wRaw || aRaw || bRaw),
          weatherLive: Boolean(wRaw),
          aqiLive: Boolean(aRaw),
          bmkgLive: Boolean(bRaw),
          updatedAt: new Date().toISOString(),
          totalCities: DATA.INDONESIA_CITIES.length,
          totalVolcanoes: DATA.INDONESIA_VOLCANOES.length
        },
        location: {
          name: loc.name || 'Klumprit',
          province: loc.province || loc.region || 'Jawa Tengah',
          region: loc.region || 'Jawa',
          lat: safeLat,
          lon: safeLon
        },
        ecoHealth: ecoHealth,
        weather: weatherObj,
        airQuality: {
          live: Boolean(aRaw),
          current: { aqi: aqi, pm25: pm25, pm10: pm10, co: co, no2: no2, so2: so2, o3: o3, dust: dust }
        },
        earthquake: {
          live: Boolean(bRaw),
          latest: latestQuake,
          recent: [latestQuake]
        },
        volcano: {
          nearest: volcanoes.nearest,
          nearbyList: volcanoes.nearbyList.slice(0, 8),
          alertCount: volcanoes.alertCount
        },
        karhutla: {
          fdrs: fdrs,
          haze: haze,
          nearest: hotspots.nearest,
          nearbyCount: hotspots.nearbyList.length,
          totalInIndo: hotspots.totalInIndo
        }
      };
    });
  }

  /**
   * Prefetch kota saat hover/touch di modal pencarian untuk transisi 0ms
   */
  function prefetchCity(city) {
    if (!city || !city.lat || !city.lon) return;
    fetchSekitarkuData(city, false).catch(function () {});
  }

  /**
   * Sinkronkan SEO dinamis (<title> & <meta name="description">)
   */
  function updateDynamicSeo() {
    if (!state.bundle) return;
    var loc = state.bundle.location || state.location;
    var aqi = state.bundle.airQuality && state.bundle.airQuality.current ? state.bundle.airQuality.current.aqi : null;
    var temp = state.bundle.weather && state.bundle.weather.current ? state.bundle.weather.current.temp : null;
    var aqiStr = aqi != null ? 'AQI ' + aqi : 'Real-Time';
    document.title = 'Cuaca ' + loc.name + ' (' + aqiStr + ') — CuacaKu × Sekitarku';
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Pantauan cuaca BMKG & Open-Meteo (' + (temp != null ? temp + '°C' : '') + '), kualitas udara ' + aqiStr + ', konversi rokok pasif, gempa bumi BMKG & gunung api PVMBG di ' + loc.name + ', ' + (loc.province || 'Indonesia') + '.'
      );
    }
  }

  /**
   * Render Bar Kota Populer & Status Lokasi di Hero
   */
  function renderCityQuickBar() {
    var bar = $('#sekitarku-popular-cities');
    if (!bar) return;
    var activeName = (state.location && state.location.name || '').replace(' (GPS)', '');
    var html = '<span class="popular-cities-label">🔥 516 Kota/Kab (38 Provinsi):</span>';
    html += DATA.POPULAR_CITIES.map(function (cityName) {
      var cityObj = DATA.findCityByName(cityName);
      if (!cityObj) return '';
      var isActive = cityObj.name === activeName;
      var shortLabel = cityObj.name.replace(' (IKN Sepaku)', ' IKN');
      return '<button type="button" class="popular-city-pill' + (isActive ? ' active' : '') + '" data-select-city="' + escapeHTML(cityObj.name) + '">' +
        escapeHTML(shortLabel) +
        '</button>';
    }).join('');
    html += '<button type="button" class="popular-city-pill popular-city-more" data-open-modal="city-search">🔍 Cari 516 Kota…</button>';
    bar.innerHTML = html;

    var cityBtnLabel = $('#btn-city-picker-label');
    if (cityBtnLabel) {
      cityBtnLabel.textContent = (state.location && state.location.name) || 'Pilih Kota';
    }
    var gpsBtn = $('#btn-gps');
    if (gpsBtn) {
      gpsBtn.classList.toggle('active', state.isGps);
      gpsBtn.innerHTML = state.gpsLoading ? '⏳ Mencari GPS…' : (state.isGps ? '🎯 GPS Aktif' : '🎯 GPS');
    }
  }

  /**
   * 1. Render Kartu Skor Lingkungan Komposit (Eco-Health 0-100), Konversi Rokok Pasif, & Kesiapan Aktivitas Outdoor
   */
  function renderEcoHealthSection() {
    if (!state.bundle) return;
    var h = state.bundle.ecoHealth;
    var aqiCur = (state.bundle.airQuality && state.bundle.airQuality.current) || {};
    var wCur = (state.bundle.weather && state.bundle.weather.current) || {};
    var loc = state.bundle.location || state.location;

    var scoreBadge = $('#eco-score-badge');
    var scoreVal = $('#eco-score-value');
    var scoreCat = $('#eco-score-category');
    var scoreSub = $('#eco-score-subtitle');
    if (scoreBadge) scoreBadge.style.backgroundColor = h.color;
    if (scoreVal) scoreVal.textContent = h.score;
    if (scoreCat) {
      scoreCat.textContent = h.category;
      scoreCat.style.color = h.color;
    }
    if (scoreSub) {
      scoreSub.textContent = 'Indeks komposit kualitas udara (AQI ' + (aqiCur.aqi || 0) + '), suhu terasa (' + formatTempC(wCur.feelsLike != null ? wCur.feelsLike : wCur.temp) + '), kelembapan (' + (wCur.humidity || 75) + '%), dan radiasi UV (' + (wCur.uvIndex != null ? wCur.uvIndex : 0) + ') di ' + loc.name + '.';
    }

    // Konversi Polusi Setara Rokok Pasif (Berkeley Earth: 1 batang ~ 22 ug/m3 PM2.5 / 24 jam)
    var cigsBox = $('#eco-cigs-box');
    var cigsValue = $('#eco-cigs-value');
    var cigsDetail = $('#eco-cigs-detail');
    var isHighCigs = h.cigs > 1.5;
    if (cigsBox) {
      cigsBox.classList.toggle('cigs-danger', isHighCigs);
    }
    if (cigsValue) {
      cigsValue.textContent = h.cigs > 0 ? ('🚬 Setara ' + h.cigs + ' batang rokok/hari') : '🌿 Udara Bersih (0 batang/hari)';
    }
    if (cigsDetail) {
      cigsDetail.textContent = 'PM2.5: ' + (aqiCur.pm25 != null ? aqiCur.pm25 : 0) + ' µg/m³ · Standar riset Berkeley Earth (1 batang ≈ 22 µg/m³ per 24 jam)';
    }

    // Matriks Kesiapan Aktivitas Outdoor
    var matrix = $('#eco-activity-matrix');
    if (matrix && h.activities) {
      var keys = ['jogging', 'cycling', 'kidsAndSeniors', 'ventilation'];
      matrix.innerHTML = keys.map(function (key) {
        var item = h.activities[key];
        if (!item) return '';
        return '<div class="eco-activity-item">' +
          '<span class="eco-activity-icon" style="background:' + escapeHTML(item.color) + '">' + item.icon + '</span>' +
          '<div class="eco-activity-copy">' +
            '<span class="eco-activity-label">' + escapeHTML(item.label) + '</span>' +
            '<strong class="eco-activity-status" style="color:' + escapeHTML(item.color) + '">' + escapeHTML(item.status) + '</strong>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    // Sub-scores bar
    var subScores = $('#eco-subscores');
    if (subScores) {
      subScores.innerHTML =
        '<div class="eco-subscore-pill"><span>Skor Udara (50%)</span><strong>' + h.aqiScore + '/100</strong></div>' +
        '<div class="eco-subscore-pill"><span>Kenyamanan Termal (25%)</span><strong>' + h.thermalScore + '/100</strong></div>' +
        '<div class="eco-subscore-pill"><span>Keamanan Sinar UV (25%)</span><strong>' + h.uvScore + '/100</strong></div>';
    }
  }

  /**
   * 2. Render Kartu Spektrum US-EPA AQI (0-500) + Jarum Dinamis + Polutan Mikro
   */
  function renderSekitarkuAqiCard() {
    if (!state.bundle) return;
    var cur = (state.bundle.airQuality && state.bundle.airQuality.current) || {};
    var aqi = Number(cur.aqi) || 0;
    var info = DATA.getUsAqiInfo(aqi);
    var h = state.bundle.ecoHealth;
    var needlePercent = Math.min(100, Math.max(0, (aqi / 500) * 100));

    var badge = $('#sekitarku-aqi-badge');
    var num = $('#sekitarku-aqi-number');
    var label = $('#sekitarku-aqi-label');
    var needle = $('#sekitarku-aqi-needle');
    var advice = $('#sekitarku-aqi-advice');
    var pollutantsGrid = $('#sekitarku-pollutants-grid');

    if (badge) {
      badge.textContent = info.label;
      badge.style.backgroundColor = info.color;
    }
    if (num) {
      num.textContent = aqi;
      num.style.color = info.color;
    }
    if (label) {
      label.textContent = 'US-EPA AQI · Setara ' + (h ? h.cigs : 0) + ' batang rokok/hari';
    }
    if (needle) {
      needle.style.left = needlePercent.toFixed(1) + '%';
    }
    if (advice) {
      advice.textContent = info.advice;
    }
    if (pollutantsGrid) {
      var items = [
        ['PM2.5', cur.pm25 != null ? cur.pm25 : 0, 'µg/m³'],
        ['PM10', cur.pm10 != null ? cur.pm10 : 0, 'µg/m³'],
        ['NO₂', cur.no2 != null ? cur.no2 : 0, 'µg/m³'],
        ['SO₂', cur.so2 != null ? cur.so2 : 0, 'µg/m³'],
        ['O₃', cur.o3 != null ? cur.o3 : 0, 'µg/m³'],
        ['CO', cur.co != null ? cur.co : 0, 'µg/m³'],
        ['Debu', cur.dust != null ? cur.dust : 0, 'µg/m³'],
        ['Rokok/hr', (h ? h.cigs : 0) + ' btg', 'Berkeley']
      ];
      pollutantsGrid.innerHTML = items.map(function (it) {
        return '<div class="sekitarku-pollutant-box">' +
          '<span class="sp-name">' + escapeHTML(it[0]) + '</span>' +
          '<strong class="sp-val">' + escapeHTML(it[1]) + '</strong>' +
          '<small class="sp-unit">' + escapeHTML(it[2]) + '</small>' +
        '</div>';
      }).join('');
    }
  }

  /**
   * 3. Render Kartu Auto-Gempa BMKG & Potensi Tsunami (Beranda + Tab Bencana)
   */
  function renderEarthquakeSection() {
    if (!state.bundle || !state.bundle.earthquake) return;
    var q = state.bundle.earthquake.latest;
    var recent = state.bundle.earthquake.recent || [];
    if (!q) return;

    var magColor = DATA.getEarthquakeColor(q.magnitude);
    var isTsunamiWarn = q.potensi && !/tidak berpotensi/i.test(q.potensi);

    var badge = $('#sekitarku-quake-badge');
    var magEl = $('#sekitarku-quake-mag');
    var timeEl = $('#sekitarku-quake-time');
    var depthEl = $('#sekitarku-quake-depth');
    var wilayahEl = $('#sekitarku-quake-wilayah');
    var distEl = $('#sekitarku-quake-distance');
    var potensiEl = $('#sekitarku-quake-potensi');
    var dirasakanEl = $('#sekitarku-quake-dirasakan');
    var recentListEl = $('#sekitarku-quake-recent-list');

    if (badge) {
      badge.textContent = 'M ' + q.magnitude;
      badge.style.backgroundColor = magColor;
    }
    if (magEl) {
      magEl.textContent = q.magnitude + ' M';
      magEl.style.color = magColor;
    }
    if (timeEl) timeEl.textContent = '🕒 ' + q.date + ' · ' + q.time;
    if (depthEl) depthEl.textContent = 'Kedalaman: ' + q.depth + ' · Koordinat: ' + q.lat + ', ' + q.lon;
    if (wilayahEl) wilayahEl.textContent = q.wilayah;
    if (distEl) {
      distEl.innerHTML = '🧭 Jarak ke episenter: <strong>' + escapeHTML(q.distanceKm) + ' km</strong> dari ' + escapeHTML(state.bundle.location.name);
    }
    if (potensiEl) {
      potensiEl.textContent = (isTsunamiWarn ? '⚠️ ' : '🛡️ ') + (q.potensi || 'Tidak berpotensi tsunami');
      potensiEl.className = 'sekitarku-tsunami-badge ' + (isTsunamiWarn ? 'tsunami-warn' : 'tsunami-safe');
    }
    if (dirasakanEl) {
      dirasakanEl.textContent = q.dirasakan && q.dirasakan !== '-' ? ('MMI Dirasakan: ' + q.dirasakan) : 'Skala MMI: Dipantau stasiun seismik BMKG InaTEWS';
    }

    if (recentListEl) {
      recentListEl.classList.toggle('hidden', !state.showRecentQuakes);
      recentListEl.innerHTML = recent.slice(0, 6).map(function (item) {
        var c = DATA.getEarthquakeColor(item.magnitude);
        return '<div class="quake-history-row">' +
          '<span class="qh-mag" style="background:' + c + '">M ' + escapeHTML(item.magnitude) + '</span>' +
          '<div class="qh-info"><strong>' + escapeHTML(item.wilayah) + '</strong><small>' + escapeHTML(item.date) + ' ' + escapeHTML(item.time) + ' · Kedalaman ' + escapeHTML(item.depth) + '</small></div>' +
          '<span class="qh-dist">' + escapeHTML(item.distanceKm) + ' km</span>' +
        '</div>';
      }).join('');
    }

    // Juga render halaman penuh di #tab-bencana
    var fullQuakeCard = $('#bencana-quake-detail');
    if (fullQuakeCard) {
      var shakemapHtml = q.shakemap
        ? '<div class="shakemap-box"><a href="' + escapeHTML(q.shakemap) + '" target="_blank" rel="noopener noreferrer" class="shakemap-link">🗺️ Buka Peta Guncangan (Shakemap Resmi BMKG) ↗</a></div>'
        : '';
      fullQuakeCard.innerHTML =
        '<div class="bencana-quake-hero">' +
          '<div class="bqh-mag" style="border-color:' + magColor + ';color:' + magColor + '">' +
            '<strong>' + escapeHTML(q.magnitude) + '</strong><span>Magnitudo</span>' +
          '</div>' +
          '<div class="bqh-meta">' +
            '<span class="bqh-time">📡 BMKG InaTEWS · ' + escapeHTML(q.date) + ' · ' + escapeHTML(q.time) + '</span>' +
            '<h3>' + escapeHTML(q.wilayah) + '</h3>' +
            '<p>Kedalaman: <strong>' + escapeHTML(q.depth) + '</strong> · Episenter: <strong>' + escapeHTML(q.lat + ', ' + q.lon) + '</strong> · Jarak dari ' + escapeHTML(state.bundle.location.name) + ': <strong>' + escapeHTML(q.distanceKm) + ' km</strong></p>' +
            '<div class="bqh-badges">' +
              '<span class="sekitarku-tsunami-badge ' + (isTsunamiWarn ? 'tsunami-warn' : 'tsunami-safe') + '">' + (isTsunamiWarn ? '⚠️ ' : '🛡️ ') + escapeHTML(q.potensi || 'Tidak berpotensi tsunami') + '</span>' +
              (q.dirasakan && q.dirasakan !== '-' ? '<span class="bqh-mmi">📊 MMI: ' + escapeHTML(q.dirasakan) + '</span>' : '') +
            '</div>' +
            shakemapHtml +
          '</div>' +
        '</div>';
    }

    var fullQuakeTable = $('#bencana-quake-table-body');
    if (fullQuakeTable) {
      fullQuakeTable.innerHTML = recent.map(function (item) {
        var c = DATA.getEarthquakeColor(item.magnitude);
        return '<tr>' +
          '<td><span class="qh-mag" style="background:' + c + '">M ' + escapeHTML(item.magnitude) + '</span></td>' +
          '<td><strong>' + escapeHTML(item.wilayah) + '</strong></td>' +
          '<td>' + escapeHTML(item.date) + ' · ' + escapeHTML(item.time) + '</td>' +
          '<td>' + escapeHTML(item.depth) + '</td>' +
          '<td>' + escapeHTML(item.distanceKm) + ' km</td>' +
          '<td>' + escapeHTML(item.potensi || 'Tidak berpotensi tsunami') + '</td>' +
        '</tr>';
      }).join('');
    }
  }

  /**
   * 4. Render Kartu Status Gunung Api Terdekat (PVMBG / MAGMA Indonesia)
   */
  function renderVolcanoSection() {
    if (!state.bundle || !state.bundle.volcano) return;
    var nearest = state.bundle.volcano.nearest;
    if (!nearest) return;

    var badge = $('#sekitarku-volcano-badge');
    var nameEl = $('#sekitarku-volcano-name');
    var metaEl = $('#sekitarku-volcano-meta');
    var distEl = $('#sekitarku-volcano-distance');
    var noteEl = $('#sekitarku-volcano-note');
    var radiusEl = $('#sekitarku-volcano-radius');

    if (badge) {
      badge.textContent = nearest.status.code + ' (' + nearest.status.name + ')';
      badge.style.backgroundColor = nearest.status.color;
    }
    if (nameEl) nameEl.textContent = '🌋 ' + nearest.name;
    if (metaEl) metaEl.textContent = nearest.province + ' · Elevasi ' + nearest.elevation + ' mdpl · ' + nearest.type;
    if (distEl) {
      distEl.textContent = nearest.distanceKm + ' km';
      distEl.style.color = nearest.distanceKm <= 50 ? '#ef4444' : '#60a5fa';
    }
    if (noteEl) noteEl.textContent = nearest.note || nearest.status.recommendation;
    if (radiusEl) {
      radiusEl.textContent = 'Radius steril kawah: ' + nearest.dangerRadiusKm + ' km · Erupsi: ' + (nearest.lastEruption || '-');
    }

    // Render direktori gunung api di #tab-bencana
    var bencanaVolcanoGrid = $('#bencana-volcano-grid');
    if (bencanaVolcanoGrid) {
      var allVolc = DATA.getNearbyVolcanoes(state.bundle.location.lat, state.bundle.location.lon, 3000).allVolcanoes;
      bencanaVolcanoGrid.innerHTML = allVolc.slice(0, 12).map(function (v) {
        return '<article class="volcano-item-card">' +
          '<div class="vic-top">' +
            '<div><strong>🌋 ' + escapeHTML(v.name) + '</strong><small>' + escapeHTML(v.province) + ' · ' + escapeHTML(v.elevation) + ' mdpl</small></div>' +
            '<span class="vic-badge" style="background:' + escapeHTML(v.status.color) + '">' + escapeHTML(v.status.code) + ' · ' + escapeHTML(v.status.name) + '</span>' +
          '</div>' +
          '<p class="vic-note">' + escapeHTML(v.note || v.status.description) + '</p>' +
          '<div class="vic-footer">' +
            '<span>🧭 Jarak: <strong>' + escapeHTML(v.distanceKm) + ' km</strong></span>' +
            '<span>⛔ Radius Bahaya: <strong>' + escapeHTML(v.dangerRadiusKm) + ' km</strong></span>' +
          '</div>' +
        '</article>';
      }).join('');
    }
  }

  /**
   * 5. Render Kartu Karhutla (FDRS BMKG) & Korelasi Cerdas Kabut Asap (KLHK SiPongi+ / NASA FIRMS)
   */
  function renderKarhutlaSection() {
    if (!state.bundle || !state.bundle.karhutla) return;
    var k = state.bundle.karhutla;
    var fdrs = k.fdrs || DATA.FDRS_LEVELS.LOW;
    var nearest = k.nearest;
    var haze = k.haze || { isHazeActive: false };

    var fdrsBadge = $('#sekitarku-fdrs-badge');
    var hazeBadge = $('#sekitarku-haze-badge');
    var hotspotName = $('#sekitarku-hotspot-name');
    var hotspotMeta = $('#sekitarku-hotspot-meta');
    var hotspotDist = $('#sekitarku-hotspot-distance');
    var fdrsDesc = $('#sekitarku-fdrs-desc');

    if (fdrsBadge) {
      fdrsBadge.textContent = 'FDRS Lahan: ' + fdrs.code;
      fdrsBadge.style.backgroundColor = fdrs.color;
    }
    if (hazeBadge) {
      hazeBadge.textContent = haze.isHazeActive ? '⚠️ Terpapar Kabut Asap' : '🟢 Bebas Kabut Asap';
      hazeBadge.className = 'sekitarku-haze-pill ' + (haze.isHazeActive ? 'haze-warn' : 'haze-clean');
    }
    if (nearest) {
      if (hotspotName) hotspotName.textContent = '🔥 ' + nearest.regency;
      if (hotspotMeta) hotspotMeta.textContent = nearest.province + ' · Satelit ' + nearest.satellite + ' · Kepercayaan ' + nearest.confidence;
      if (hotspotDist) hotspotDist.textContent = 'Jarak titik panas: ' + nearest.distanceKm + ' km dari ' + state.bundle.location.name + ' (FRP ' + nearest.frpMw + ' MW)';
    } else {
      if (hotspotName) hotspotName.textContent = 'Tidak ada titik panas dekat';
      if (hotspotMeta) hotspotMeta.textContent = 'Pantauan satelit VIIRS SNPP & MODIS normal';
      if (hotspotDist) hotspotDist.textContent = 'Radius 400 km bersih';
    }
    if (fdrsDesc) {
      fdrsDesc.textContent = fdrs.desc;
    }
  }

  /**
   * 6. Render Modal Pencarian 516 Kota & Kabupaten Indonesia
   */
  function renderCitySearchModalList() {
    var listEl = $('#city-modal-list');
    var countEl = $('#city-modal-count');
    var regionPillsEl = $('#city-modal-regions');
    if (!listEl) return;

    if (regionPillsEl) {
      regionPillsEl.innerHTML = DATA.REGIONS.map(function (reg) {
        var active = state.cityRegionFilter === reg;
        return '<button type="button" class="modal-filter-pill' + (active ? ' active' : '') + '" data-city-region="' + escapeHTML(reg) + '">' + escapeHTML(reg) + '</button>';
      }).join('');
    }

    var q = state.citySearchTerm.toLowerCase().trim();
    var filtered = DATA.INDONESIA_CITIES.filter(function (city) {
      var matchReg = state.cityRegionFilter === 'Semua' ||
        city.region === state.cityRegionFilter ||
        (state.cityRegionFilter === 'Nusantara' && city.name.toLowerCase().includes('nusantara'));
      if (!matchReg) return false;
      if (!q) return true;
      return city.name.toLowerCase().includes(q) ||
        city.province.toLowerCase().includes(q) ||
        city.region.toLowerCase().includes(q);
    });

    if (countEl) {
      countEl.textContent = 'Menampilkan ' + Math.min(100, filtered.length) + ' dari ' + filtered.length + ' kota & kabupaten (Total 38 Provinsi · ' + DATA.INDONESIA_CITIES.length + ' Wilayah)';
    }

    var currentClean = (state.location && state.location.name || '').replace(' (GPS)', '');
    if (!filtered.length) {
      listEl.innerHTML = '<div class="modal-empty-state">Tidak ditemukan kota/kabupaten untuk "' + escapeHTML(state.citySearchTerm) + '". Coba kata kunci atau provinsi lain.</div>';
      return;
    }

    listEl.innerHTML = filtered.slice(0, 100).map(function (city) {
      var isSelected = city.name === currentClean;
      return '<button type="button" class="city-result-item' + (isSelected ? ' active' : '') + '" data-pick-city="' + escapeHTML(city.name) + '">' +
        '<div class="cri-left">' +
          '<span class="cri-pin">📍</span>' +
          '<div><strong>' + escapeHTML(city.name) + '</strong><small>' + escapeHTML(city.province) + ' · ' + escapeHTML(city.region) + ' (' + city.lat.toFixed(2) + ', ' + city.lon.toFixed(2) + ')</small></div>' +
        '</div>' +
        '<span class="cri-badge">' + (isSelected ? '✓ Aktif' : 'Pilih →') + '</span>' +
      '</button>';
    }).join('');
  }

  /**
   * 7. Render Modal Direktori 29 Gunung Api PVMBG
   */
  function renderVolcanoModalList() {
    var listEl = $('#volcano-modal-list');
    var regionEl = $('#volcano-modal-regions');
    var statusEl = $('#volcano-modal-statuses');
    if (!listEl) return;

    var volcRegions = ['Semua', 'Jawa', 'Sumatera', 'Bali & Nusa Tenggara', 'Sulawesi', 'Maluku'];
    if (regionEl) {
      regionEl.innerHTML = volcRegions.map(function (r) {
        var active = state.volcanoRegionFilter === r;
        return '<button type="button" class="modal-filter-pill' + (active ? ' active' : '') + '" data-volcano-region="' + escapeHTML(r) + '">' + escapeHTML(r) + '</button>';
      }).join('');
    }

    var statusFilters = [
      { id: 'ALL', label: 'Semua Status' },
      { id: 'ALERT', label: 'Siaga & Awas (Level III/IV)' },
      { id: 'WASPADA', label: 'Waspada (Level II)' },
      { id: 'NORMAL', label: 'Normal (Level I)' }
    ];
    if (statusEl) {
      statusEl.innerHTML = statusFilters.map(function (sf) {
        var active = state.volcanoStatusFilter === sf.id;
        return '<button type="button" class="modal-filter-pill' + (active ? ' active' : '') + '" data-volcano-status="' + escapeHTML(sf.id) + '">' + escapeHTML(sf.label) + '</button>';
      }).join('');
    }

    var all = DATA.getNearbyVolcanoes(state.location.lat, state.location.lon, 5000).allVolcanoes;
    var q = state.volcanoSearchTerm.toLowerCase().trim();
    var filtered = all.filter(function (v) {
      var matchSearch = !q || v.name.toLowerCase().includes(q) || v.province.toLowerCase().includes(q);
      var matchRegion = state.volcanoRegionFilter === 'Semua' || v.region === state.volcanoRegionFilter;
      var matchStatus = true;
      if (state.volcanoStatusFilter === 'ALERT') matchStatus = v.statusLevel >= 3;
      else if (state.volcanoStatusFilter === 'WASPADA') matchStatus = v.statusLevel === 2;
      else if (state.volcanoStatusFilter === 'NORMAL') matchStatus = v.statusLevel === 1;
      return matchSearch && matchRegion && matchStatus;
    });

    listEl.innerHTML = filtered.map(function (v) {
      return '<div class="volcano-item-card">' +
        '<div class="vic-top">' +
          '<div><strong>🌋 ' + escapeHTML(v.name) + '</strong><small>' + escapeHTML(v.province) + ' · ' + escapeHTML(v.elevation) + ' mdpl</small></div>' +
          '<span class="vic-badge" style="background:' + escapeHTML(v.status.color) + '">' + escapeHTML(v.status.code) + ' (' + escapeHTML(v.status.name) + ')</span>' +
        '</div>' +
        '<p class="vic-note">' + escapeHTML(v.note || v.status.description) + '</p>' +
        '<div class="vic-footer">' +
          '<span>🧭 Jarak dari ' + escapeHTML(state.location.name) + ': <strong>' + escapeHTML(v.distanceKm) + ' km</strong></span>' +
          '<span>⛔ Radius Bahaya Kawah: <strong>' + escapeHTML(v.dangerRadiusKm) + ' km</strong></span>' +
        '</div>' +
      '</div>';
    }).join('') || '<div class="modal-empty-state">Tidak ada gunung api yang cocok dengan filter ini.</div>';
  }

  /**
   * 8. Render Modal Daftar 122 Titik Panas Karhutla
   */
  function renderKarhutlaModalList() {
    var listEl = $('#karhutla-modal-list');
    var regionEl = $('#karhutla-modal-islands');
    if (!listEl) return;

    var islands = ['Semua', 'Sumatera', 'Kalimantan', 'Jawa', 'Sulawesi', 'Bali & Nusa Tenggara', 'Maluku & Papua'];
    if (regionEl) {
      regionEl.innerHTML = islands.map(function (isl) {
        var active = state.karhutlaIslandFilter === isl;
        return '<button type="button" class="modal-filter-pill' + (active ? ' active' : '') + '" data-karhutla-island="' + escapeHTML(isl) + '">' + escapeHTML(isl) + '</button>';
      }).join('');
    }

    var all = DATA.getNearbyHotspots(state.location.lat, state.location.lon, 5000).allHotspots;
    var q = state.karhutlaSearchTerm.toLowerCase().trim();
    var filtered = all.filter(function (h) {
      var matchSearch = !q || h.regency.toLowerCase().includes(q) || h.province.toLowerCase().includes(q);
      var matchIsl = state.karhutlaIslandFilter === 'Semua' || h.island === state.karhutlaIslandFilter;
      return matchSearch && matchIsl;
    });

    listEl.innerHTML = filtered.slice(0, 60).map(function (h) {
      var isHigh = h.confidenceLevel === 'HIGH';
      return '<div class="volcano-item-card">' +
        '<div class="vic-top">' +
          '<div><strong>🔥 ' + escapeHTML(h.regency) + '</strong><small>' + escapeHTML(h.province) + ' · ' + escapeHTML(h.island) + '</small></div>' +
          '<span class="vic-badge" style="background:' + (isHigh ? '#ef4444' : '#f59e0b') + '">' + escapeHTML(h.confidence) + '</span>' +
        '</div>' +
        '<p class="vic-note">' + escapeHTML(h.type) + ' · Satelit ' + escapeHTML(h.satellite) + ' · Radiasi Api FRP ' + escapeHTML(h.frpMw) + ' MW (' + escapeHTML(h.brightnessK) + ' K)</p>' +
        '<div class="vic-footer">' +
          '<span>🧭 Jarak: <strong>' + escapeHTML(h.distanceKm) + ' km</strong></span>' +
          '<span>📡 Sumber: ' + escapeHTML(h.source) + '</span>' +
        '</div>' +
      '</div>';
    }).join('') || '<div class="modal-empty-state">Tidak ditemukan titik panas untuk filter ini.</div>';
  }

  /**
   * 9. Render Modal Panduan Tanggap Bencana & Kontak Darurat 112
   */
  function renderEmergencyModalContent() {
    var bodyEl = $('#emergency-modal-body');
    if (!bodyEl) return;

    var contactsHtml = '<div class="emergency-contacts-grid">' +
      DATA.EMERGENCY_CONTACTS.map(function (c) {
        return '<a href="tel:' + escapeHTML(c.number) + '" class="emergency-contact-card" style="border-left: 4px solid ' + escapeHTML(c.color) + ';background:' + escapeHTML(c.bg) + '">' +
          '<div class="ecc-num" style="background:' + escapeHTML(c.color) + '">📞 ' + escapeHTML(c.number) + '</div>' +
          '<div class="ecc-info"><strong>' + escapeHTML(c.name) + '</strong><p>' + escapeHTML(c.desc) + '</p></div>' +
        '</a>';
      }).join('') +
    '</div>';

    var protocolsHtml = '<div class="emergency-protocols-list">' +
      DATA.EMERGENCY_PROTOCOLS.map(function (p) {
        return '<div class="emergency-protocol-card">' +
          '<h4>' + p.icon + ' ' + escapeHTML(p.title) + '</h4>' +
          '<ul>' + p.steps.map(function (s) { return '<li>' + escapeHTML(s) + '</li>'; }).join('') + '</ul>' +
        '</div>';
      }).join('') +
    '</div>';

    bodyEl.innerHTML = contactsHtml + protocolsHtml;
  }

  /**
   * 10. Generator Kartu Infografis 9:16 HD (1080 x 1920) ke IG / WA Story via HTML5 Canvas 2D
   */
  function buildShareSummaryText() {
    if (!state.bundle) return '';
    var loc = state.bundle.location || state.location;
    var h = state.bundle.ecoHealth;
    var aqi = state.bundle.airQuality.current.aqi;
    var pm25 = state.bundle.airQuality.current.pm25;
    var w = state.bundle.weather.current;
    var vis = DATA.getWmoWeatherVisual(w.weatherCode, w.isDay);
    var q = state.bundle.earthquake && state.bundle.earthquake.latest;
    var v = state.bundle.volcano && state.bundle.volcano.nearest;
    var k = state.bundle.karhutla;

    return '📍 Laporan Lingkungan & Cuaca Real-Time: ' + loc.name + ', ' + (loc.province || 'Indonesia') + '\n' +
      '🌿 Skor Lingkungan: ' + h.score + '/100 (' + h.category + ')\n' +
      '🌫️ Kualitas Udara: US-AQI ' + aqi + ' · PM2.5 ' + pm25 + ' µg/m³\n' +
      '🚬 Konversi Polusi: Setara ' + h.cigs + ' batang rokok pasif/hari\n' +
      '⛅ Cuaca BMKG/Open-Meteo: ' + w.temp + '°C (Terasa ' + w.feelsLike + '°C) · ' + vis.label + ' · Kelembapan ' + w.humidity + '%\n' +
      (v ? '🌋 Gunung Api Terdekat: ' + v.name + ' (' + v.status.code + ' ' + v.status.name + ', ' + v.distanceKm + ' km)\n' : '') +
      (q ? '🫨 Gempa Terkini BMKG: M ' + q.magnitude + ' · ' + q.wilayah + ' (' + q.potensi + ')\n' : '') +
      (k && k.fdrs ? '🔥 Status Karhutla FDRS: ' + k.fdrs.code + ' · ' + (k.haze && k.haze.isHazeActive ? 'Waspada Kabut Asap' : 'Bebas Asap') + '\n' : '') +
      '\nPantau real-time 500+ kota Indonesia di CuacaKu × Sekitarku!';
  }

  function generateStoryCanvasDataUrl() {
    var canvas = $('#share-story-canvas');
    if (!canvas || !state.bundle) return null;
    canvas.width = 1080;
    canvas.height = 1920;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var loc = state.bundle.location || state.location;
    var h = state.bundle.ecoHealth;
    var aqiCur = state.bundle.airQuality.current;
    var aqiInfo = DATA.getUsAqiInfo(aqiCur.aqi);
    var wCur = state.bundle.weather.current;
    var wVis = DATA.getWmoWeatherVisual(wCur.weatherCode, wCur.isDay);
    var q = state.bundle.earthquake && state.bundle.earthquake.latest;
    var v = state.bundle.volcano && state.bundle.volcano.nearest;
    var k = state.bundle.karhutla || {};
    var fdrs = k.fdrs || DATA.FDRS_LEVELS.LOW;
    var hazeActive = k.haze && k.haze.isHazeActive;
    var nowStr = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta'
    }).format(new Date()) + ' WIB';

    function drawCard(x, y, w, height, fill, borderColor) {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, height, 28);
      else ctx.rect(x, y, w, height);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = borderColor || '#e2e8f0';
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }

    function drawWrapped(text, x, y, maxWidth, lineHeight, maxLines) {
      var words = String(text || '').split(' ');
      var line = '';
      var count = 0;
      var curY = y;
      for (var i = 0; i < words.length; i++) {
        var test = line + (line ? ' ' : '') + words[i];
        if (ctx.measureText(test).width > maxWidth && i > 0) {
          count++;
          if (count >= (maxLines || 2)) {
            ctx.fillText(line + '…', x, curY);
            return curY + lineHeight;
          }
          ctx.fillText(line, x, curY);
          line = words[i];
          curY += lineHeight;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, x, curY);
      return curY + lineHeight;
    }

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1080, 1920);

    // Top Accent Bar
    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, 0, 1080, 22);

    // Header Brand
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 56px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('CuacaKu × Sekitarku', 80, 110);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Laporan Lingkungan Hidup, Cuaca BMKG & Mitigasi Bencana Real-Time', 80, 155);

    // 1. Location Card
    drawCard(80, 190, 920, 195, '#1e293b', '#334155');
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 46px "Plus Jakarta Sans", sans-serif';
    drawWrapped('📍 ' + loc.name, 115, 255, 850, 50, 1);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
    ctx.fillText((loc.province || 'Indonesia') + ' · Koordinat ' + Number(loc.lat).toFixed(2) + ', ' + Number(loc.lon).toFixed(2), 115, 305);

    ctx.fillStyle = '#34d399';
    ctx.font = '700 23px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('🕒 ' + nowStr, 115, 350);

    // 2. Eco-Health & Passive Cigarette Card
    drawCard(80, 410, 920, 265, '#1e293b', h.color || '#10b981');
    ctx.fillStyle = '#94a3b8';
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('SKOR LINGKUNGAN & KESIAPAN AKTIVITAS OUTDOOR', 115, 458);

    ctx.fillStyle = h.color || '#10b981';
    ctx.font = '800 88px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(String(h.score), 115, 555);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('/100', 255, 555);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 32px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(h.category, 370, 515);

    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 25px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('🚬 Setara ' + h.cigs + ' batang rokok pasif/hari (PM2.5: ' + aqiCur.pm25 + ' µg/m³)', 370, 560);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    var actText = '🏃 Jogging: ' + h.activities.jogging.status + '   ·   🚴 Sepeda: ' + h.activities.cycling.status + '   ·   👶 Anak/Lansia: ' + h.activities.kidsAndSeniors.status + '   ·   🪟 ' + h.activities.ventilation.status;
    drawWrapped(actText, 115, 632, 850, 30, 1);

    // 3. Grid: AQI & Weather
    drawCard(80, 700, 445, 290, '#1e293b', '#334155');
    ctx.fillStyle = aqiInfo.color;
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('KUALITAS UDARA (US-EPA)', 115, 748);
    ctx.font = '800 76px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(String(aqiCur.aqi), 115, 840);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
    drawWrapped(aqiInfo.label, 115, 895, 380, 32, 1);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('PM2.5: ' + aqiCur.pm25 + ' · PM10: ' + aqiCur.pm10 + ' µg/m³', 115, 950);

    drawCard(555, 700, 445, 290, '#1e293b', '#334155');
    ctx.fillStyle = '#60a5fa';
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('CUACA BMKG & OPEN-METEO', 590, 748);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 76px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(wCur.temp + '°C', 590, 840);
    ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
    drawWrapped(wVis.label, 590, 895, 380, 32, 1);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Terasa ' + wCur.feelsLike + '°C · Lembap ' + wCur.humidity + '% · UV ' + wCur.uvIndex, 590, 950);

    // 4. Volcano PVMBG & Karhutla FDRS Card
    drawCard(80, 1015, 920, 295, '#1e293b', '#334155');
    ctx.fillStyle = '#f97316';
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('GUNUNG API TERDEKAT (PVMBG/MAGMA) & INDEKS KARHUTLA (FDRS BMKG)', 115, 1062);

    if (v) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('🌋 ' + v.name + ' (' + v.distanceKm + ' km)', 115, 1115);
      ctx.fillStyle = v.status.color;
      ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Status PVMBG: ' + v.status.code + ' — ' + v.status.name + ' (Radius steril ' + v.dangerRadiusKm + ' km)', 115, 1155);
    }
    ctx.fillStyle = hazeActive ? '#ef4444' : '#34d399';
    ctx.font = '700 23px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('🔥 Kerawanan Lahan FDRS: ' + fdrs.code + ' · Status Asap: ' + (hazeActive ? 'TERPAPAR KABUT ASAP' : 'Bebas Kabut Asap'), 115, 1210);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 21px "Plus Jakarta Sans", sans-serif';
    var hsText = k.nearest ? ('Titik Api Terdekat: ' + k.nearest.regency + ' (' + k.nearest.distanceKm + ' km · ' + k.nearest.satellite + ')') : 'Tidak ada titik panas dekat';
    drawWrapped(hsText, 115, 1255, 850, 28, 1);

    // 5. Auto-Gempa BMKG & Tsunami Card
    drawCard(80, 1335, 920, 275, '#1e293b', '#ef4444');
    ctx.fillStyle = '#f87171';
    ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('INFO AUTO-GEMPA TERKINI BMKG & POTENSI TSUNAMI', 115, 1382);

    if (q) {
      ctx.fillStyle = '#ef4444';
      ctx.font = '800 54px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('M ' + q.magnitude, 115, 1465);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
      drawWrapped(q.wilayah, 310, 1435, 655, 34, 2);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(q.date + ' ' + q.time + ' · Kedalaman ' + q.depth + ' · Jarak ' + q.distanceKm + ' km', 310, 1525);

      ctx.fillStyle = '#34d399';
      ctx.font = '800 23px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('🛡️ ' + (q.potensi || 'Tidak berpotensi tsunami'), 115, 1575);
    }

    // Footer Branding
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CuacaKu × Sekitarku · 500+ Kota Indonesia Real-Time', 540, 1735);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Sumber Resmi: BMKG InaTEWS · Open-Meteo · PVMBG MAGMA ESDM · KLHK SiPongi+', 540, 1780);
    ctx.textAlign = 'left';

    try {
      state.shareDataUrl = canvas.toDataURL('image/png', 0.95);
      return state.shareDataUrl;
    } catch (e) {
      return null;
    }
  }

  function openModal(modalId) {
    var el = document.getElementById(modalId + '-modal');
    if (!el) return;
    el.classList.remove('hidden');
    if (modalId === 'city-search') {
      renderCitySearchModalList();
      var input = $('#city-modal-search-input');
      if (input) window.setTimeout(function () { input.focus(); }, 60);
    } else if (modalId === 'volcano-list') {
      renderVolcanoModalList();
    } else if (modalId === 'karhutla-list') {
      renderKarhutlaModalList();
    } else if (modalId === 'emergency-guide') {
      renderEmergencyModalContent();
    } else if (modalId === 'share-card') {
      generateStoryCanvasDataUrl();
      var textPreview = $('#share-text-preview');
      if (textPreview) textPreview.value = buildShareSummaryText();
    }
  }

  function closeAllModals() {
    $all('.sekitarku-modal-overlay').forEach(function (el) {
      el.classList.add('hidden');
    });
  }

  function selectCity(cityObj, fromGps) {
    if (!cityObj) return;
    state.location = cityObj;
    state.isGps = Boolean(fromGps);
    saveSelectedCity(cityObj);
    window._cuacakuLocationQuery = buildLocationQuery(cityObj);
    renderCityQuickBar();
    refreshAllSekitarku(false);
  }

  function requestGpsLocation() {
    if (!navigator.geolocation) {
      window.alert('Browser Anda tidak mendukung fitur Geolocation GPS.');
      return;
    }
    state.gpsLoading = true;
    renderCityQuickBar();
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        state.gpsLoading = false;
        var lat = pos.coords.latitude;
        var lon = pos.coords.longitude;
        var nearest = DATA.findNearestCity(lat, lon);
        var gpsCity = {
          name: (nearest ? nearest.name : 'Lokasi Anda') + ' (GPS)',
          province: nearest ? nearest.province : 'Indonesia',
          region: nearest ? nearest.region : 'Indonesia',
          lat: Math.round(lat * 10000) / 10000,
          lon: Math.round(lon * 10000) / 10000
        };
        selectCity(gpsCity, true);
      },
      function () {
        state.gpsLoading = false;
        renderCityQuickBar();
        window.alert('Tidak dapat mengakses lokasi GPS. Pastikan izin lokasi browser diaktifkan, atau pilih dari 516 kota yang tersedia.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  function applyBundleToCuacaKu(bundle) {
    if (!bundle) return;
    // Update radar coordinates label
    var radarCoords = $('#radar-coordinates');
    if (radarCoords && bundle.location) {
      radarCoords.textContent = Number(bundle.location.lat).toFixed(2) + ', ' + Number(bundle.location.lon).toFixed(2) + ' · WIB';
    }
    var radarLocStrong = document.querySelector('.radar-location strong');
    if (radarLocStrong && bundle.location) {
      radarLocStrong.textContent = bundle.location.name;
    }

    // Jika OpenWeather tidak aktif ATAU pengguna mengganti kota dari Klumprit,
    // gunakan data live Open-Meteo + BMKG agar seluruh kartu cuaca & grafik menampilkan kota terpilih!
    var isDefaultKlumprit = Math.abs(Number(bundle.location.lat) - (-7.42)) < 0.02 && Math.abs(Number(bundle.location.lon) - 109.24) < 0.02;
    var openWeatherIsLive = window.WEATHER_DATA && window.WEATHER_DATA.meta && window.WEATHER_DATA.meta.live && window.WEATHER_DATA.provider && window.WEATHER_DATA.provider.name === 'OpenWeather';

    // Audit 14 Okt 2026: hanya data Open-Meteo yang benar-benar live boleh menggantikan payload utama.
    // Data contoh (weather.live === false) tidak pernah lagi dipromosikan menjadi "live".
    var compatIsLive = Boolean(bundle.cuacakuCompat && bundle.cuacakuCompat.live === true);
    if (bundle.cuacakuCompat && compatIsLive && (!openWeatherIsLive || !isDefaultKlumprit)) {
      var compat = bundle.cuacakuCompat;
      window.WEATHER_DATA.location = compat.location;
      window.WEATHER_DATA.current = compat.current;
      window.WEATHER_DATA.dailyForecast = compat.dailyForecast;
      window.WEATHER_DATA.hourlyForecast = compat.hourlyForecast;
      window.WEATHER_DATA.airQuality = compat.airQuality;
      var previousModules = (window.WEATHER_DATA.provider && window.WEATHER_DATA.provider.modules) || {};
      window.WEATHER_DATA.provider = {
        name: 'Open-Meteo',
        refreshIntervalSeconds: (window.WEATHER_DATA.provider && window.WEATHER_DATA.provider.refreshIntervalSeconds) || 600,
        modules: {
          current: { live: true, product: 'Open-Meteo Forecast API' },
          dailyForecast: { live: Boolean(compat.dailyForecast && compat.dailyForecast.length), days: compat.dailyForecast ? compat.dailyForecast.length : 0, product: 'Open-Meteo Forecast API · hingga 7 hari' },
          hourlyForecast: { live: Boolean(compat.hourlyForecast && compat.hourlyForecast.today && compat.hourlyForecast.today.length), intervalMinutes: 60, product: 'Open-Meteo Forecast API · per jam' },
          minuteCast: { live: false, product: 'Open-Meteo tidak menyediakan timeline per menit' },
          airQuality: compat.aqiLive === true
            ? { live: true, product: 'Open-Meteo / Copernicus Atmosphere · US-EPA AQI', error: null }
            : { live: false, product: 'Open-Meteo / Copernicus Atmosphere · tidak tersedia', error: 'OPEN_METEO_AQI_UNAVAILABLE' },
          monthly: { live: false, product: previousModules.monthly && previousModules.monthly.product || 'Timeline per bulan memerlukan One Call API 4.0' },
          radar: { live: false, product: 'Radar peta tetap simulasi (produk peta terpisah)' }
        }
      };
      window.WEATHER_DATA.meta.live = true;
      window.WEATHER_DATA.meta.source = 'Open-Meteo';
      window.WEATHER_DATA.meta.providerName = 'Open-Meteo';
      if (!openWeatherIsLive) {
        window.WEATHER_DATA.meta.fallback = { from: 'OpenWeather', provider: 'Open-Meteo', note: 'OpenWeather tidak aktif; Sekitarku mengisi kartu cuaca dari Open-Meteo (live).' };
      }
      window.WEATHER_DATA.meta.snapshotLabel = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta'
      }).format(new Date()) + ' WIB';
      if (window.WEATHER_UI && typeof window.WEATHER_UI.renderAll === 'function') {
        window.WEATHER_UI.renderAll();
      }
      if (window.WEATHER_UI && typeof window.WEATHER_UI.updateDataNotice === 'function') {
        window.WEATHER_UI.updateDataNotice();
      }
    }
  }

  function renderAllSekitarku() {
    renderCityQuickBar();
    renderEcoHealthSection();
    renderSekitarkuAqiCard();
    renderEarthquakeSection();
    renderVolcanoSection();
    renderKarhutlaSection();
    updateDynamicSeo();
  }

  function refreshAllSekitarku(force) {
    state.loading = true;
    return fetchSekitarkuData(state.location, force).then(function (bundle) {
      state.bundle = bundle;
      state.loading = false;
      applyBundleToCuacaKu(bundle);
      renderAllSekitarku();
      if (window.WEATHER_UI && typeof window.WEATHER_UI.loadLiveData === 'function') {
        window.WEATHER_UI.loadLiveData(buildLocationQuery(state.location));
      }
      return bundle;
    }).catch(function () {
      state.loading = false;
    });
  }

  function handleShareNative() {
    var dataUrl = generateStoryCanvasDataUrl();
    var shareText = buildShareSummaryText();
    var locName = (state.location && state.location.name || 'indonesia').toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (!dataUrl) return;
    fetch(dataUrl)
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        var file = new File([blob], 'sekitarku-cuacaku-' + locName + '.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator.share({
            files: [file],
            title: 'Laporan Cuaca & AQI ' + state.location.name,
            text: shareText
          });
        } else if (navigator.share) {
          return navigator.share({
            title: 'Laporan Cuaca & AQI ' + state.location.name,
            text: shareText,
            url: window.location.href
          });
        } else {
          handleDownloadStoryPng();
        }
      })
      .catch(function (err) {
        if (!err || err.name !== 'AbortError') {
          handleDownloadStoryPng();
        }
      });
  }

  function handleDownloadStoryPng() {
    var dataUrl = generateStoryCanvasDataUrl();
    if (!dataUrl) return;
    var locName = (state.location && state.location.name || 'indonesia').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    var link = document.createElement('a');
    link.download = 'sekitarku-story-' + locName + '.png';
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleCopyShareText() {
    var text = buildShareSummaryText();
    var btn = $('#btn-copy-share-text');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (btn) {
          var prev = btn.textContent;
          btn.textContent = '✓ Tersalin ke Clipboard!';
          window.setTimeout(function () { btn.textContent = prev; }, 2000);
        }
      });
    }
  }

  function setupEvents() {
    document.addEventListener('click', function (e) {
      var openModalBtn = e.target.closest('[data-open-modal]');
      if (openModalBtn) {
        openModal(openModalBtn.getAttribute('data-open-modal'));
        return;
      }

      var closeModalBtn = e.target.closest('[data-close-modal]');
      if (closeModalBtn || e.target.classList.contains('sekitarku-modal-overlay')) {
        closeAllModals();
        return;
      }

      var selectCityBtn = e.target.closest('[data-select-city]');
      if (selectCityBtn) {
        var city = DATA.findCityByName(selectCityBtn.getAttribute('data-select-city'));
        if (city) selectCity(city, false);
        return;
      }

      var pickCityBtn = e.target.closest('[data-pick-city]');
      if (pickCityBtn) {
        var chosen = DATA.findCityByName(pickCityBtn.getAttribute('data-pick-city'));
        if (chosen) {
          selectCity(chosen, false);
          closeAllModals();
        }
        return;
      }

      var cityRegionBtn = e.target.closest('[data-city-region]');
      if (cityRegionBtn) {
        state.cityRegionFilter = cityRegionBtn.getAttribute('data-city-region');
        renderCitySearchModalList();
        return;
      }

      var volcanoRegionBtn = e.target.closest('[data-volcano-region]');
      if (volcanoRegionBtn) {
        state.volcanoRegionFilter = volcanoRegionBtn.getAttribute('data-volcano-region');
        renderVolcanoModalList();
        return;
      }

      var volcanoStatusBtn = e.target.closest('[data-volcano-status]');
      if (volcanoStatusBtn) {
        state.volcanoStatusFilter = volcanoStatusBtn.getAttribute('data-volcano-status');
        renderVolcanoModalList();
        return;
      }

      var karhutlaIslBtn = e.target.closest('[data-karhutla-island]');
      if (karhutlaIslBtn) {
        state.karhutlaIslandFilter = karhutlaIslBtn.getAttribute('data-karhutla-island');
        renderKarhutlaModalList();
        return;
      }

      if (e.target.closest('#btn-gps') || e.target.closest('#btn-gps-hero') || e.target.closest('#btn-gps-modal')) {
        closeAllModals();
        requestGpsLocation();
        return;
      }

      if (e.target.closest('#btn-toggle-recent-quakes')) {
        state.showRecentQuakes = !state.showRecentQuakes;
        var toggleBtn = $('#btn-toggle-recent-quakes');
        if (toggleBtn) toggleBtn.textContent = state.showRecentQuakes ? '▲ Tutup Riwayat Gempa' : '▼ Riwayat 15 Gempa BMKG';
        renderEarthquakeSection();
        return;
      }

      if (e.target.closest('#btn-share-native')) {
        handleShareNative();
        return;
      }

      if (e.target.closest('#btn-download-story')) {
        handleDownloadStoryPng();
        return;
      }

      if (e.target.closest('#btn-copy-share-text')) {
        handleCopyShareText();
        return;
      }

      if (e.target.closest('#btn-install-pwa')) {
        if (state.deferredPwaPrompt) {
          state.deferredPwaPrompt.prompt();
          state.deferredPwaPrompt.userChoice.finally(function () {
            state.deferredPwaPrompt = null;
          });
        } else {
          window.alert('Aplikasi ini sudah PWA-Ready! Di Chrome/Edge/Safari, pilih menu "Tambahkan ke Layar Utama" (Add to Home Screen) atau "Instal Aplikasi" untuk memasang secara mandiri.');
        }
        return;
      }
    });

    // Hover prefetch di daftar kota
    document.addEventListener('mouseover', function (e) {
      var btn = e.target.closest('[data-pick-city], [data-select-city]');
      if (btn) {
        var name = btn.getAttribute('data-pick-city') || btn.getAttribute('data-select-city');
        var city = DATA.findCityByName(name);
        if (city) prefetchCity(city);
      }
    });

    var cityInput = $('#city-modal-search-input');
    if (cityInput) {
      cityInput.addEventListener('input', function () {
        state.citySearchTerm = cityInput.value;
        renderCitySearchModalList();
      });
    }

    var volcInput = $('#volcano-modal-search-input');
    if (volcInput) {
      volcInput.addEventListener('input', function () {
        state.volcanoSearchTerm = volcInput.value;
        renderVolcanoModalList();
      });
    }

    var karhutlaInput = $('#karhutla-modal-search-input');
    if (karhutlaInput) {
      karhutlaInput.addEventListener('input', function () {
        state.karhutlaSearchTerm = karhutlaInput.value;
        renderKarhutlaModalList();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllModals();
    });

    // Hook tombol refresh bawaan agar juga me-refresh data Sekitarku
    $all('.btn-refresh').forEach(function (btn) {
      btn.addEventListener('click', function () {
        refreshAllSekitarku(true);
      });
    });

    // PWA Install Prompt & Service Worker
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      state.deferredPwaPrompt = e;
      var installBtn = $('#btn-install-pwa');
      if (installBtn) installBtn.classList.remove('hidden');
    });

    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  function initSekitarku() {
    window._cuacakuLocationQuery = buildLocationQuery(state.location);
    window.onCuacaKuRender = function () {
      renderEcoHealthSection();
      renderSekitarkuAqiCard();
    };
    setupEvents();
    renderCityQuickBar();
    refreshAllSekitarku(false);
  }

  window.SEKITARKU_APP = {
    selectCity: selectCity,
    requestGpsLocation: requestGpsLocation,
    refreshAllSekitarku: refreshAllSekitarku,
    openModal: openModal,
    generateStoryCanvasDataUrl: generateStoryCanvasDataUrl,
    getState: function () { return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSekitarku, { once: true });
  } else {
    initSekitarku();
  }
})();
