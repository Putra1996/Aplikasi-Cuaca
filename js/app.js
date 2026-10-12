/**
 * Aplikasi Cuaca Klumprit - Main Application
 * Sumber data: AccuWeather
 */

(function() {
  'use strict';

  // ===== STATE =====
  let isCelsius = false;
  let currentTab = 'beranda';
  let currentHourlyDay = 'today';

  // ===== HELPERS =====
  function temp(f) {
    return isCelsius ? WEATHER_DATA.toCelsius(f) + '°' : f + '°';
  }

  function tempVal(f) {
    return isCelsius ? WEATHER_DATA.toCelsius(f) : f;
  }

  // ===== INIT =====
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initApp, 1200);
  });

  function initApp() {
    // Hide loading, show app
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 600);
    document.getElementById('app').classList.remove('hidden');

    // Event listeners
    setupNavigation();
    setupUnitToggle();
    setupRefresh();
    setupHamburger();
    setupHourlyTabs();

    // Render all
    renderFiveDayForecast();
    renderDailyForecast();
    renderHourlyForecast('today');
    renderMonthlyCalendar();
    renderMonthlyTable();
    updateMonthlySummary();
    animateComfortGauges();
  }

  // ===== NAVIGATION =====
  function setupNavigation() {
    document.querySelectorAll('.nav-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        const target = this.dataset.tab;
        switchTab(target);
      });
    });
  }

  function switchTab(tabName) {
    currentTab = tabName;

    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(function(c) {
      c.classList.remove('active');
    });
    var targetContent = document.getElementById('tab-' + tabName);
    if (targetContent) {
      targetContent.classList.add('active');
    }

    // Close mobile nav
    var mobileNav = document.getElementById('mobile-nav');
    var hamburger = document.getElementById('hamburger');
    if (mobileNav && !mobileNav.classList.contains('hidden')) {
      mobileNav.classList.add('hidden');
      hamburger.classList.remove('active');
    }

    // Draw charts if needed
    if (tabName === 'harian' && typeof drawDailyChart === 'function') {
      setTimeout(drawDailyChart, 100);
    }
    if (tabName === 'per-jam' && typeof drawHourlyChart === 'function') {
      setTimeout(function() { drawHourlyChart(currentHourlyDay); }, 100);
    }
    if (tabName === 'bulanan' && typeof drawMonthlyChart === 'function') {
      setTimeout(drawMonthlyChart, 100);
    }
    if (tabName === 'beranda') {
      animateComfortGauges();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ===== UNIT TOGGLE =====
  function setupUnitToggle() {
    var btn = document.getElementById('btn-unit');
    btn.addEventListener('click', function() {
      isCelsius = !isCelsius;
      btn.classList.toggle('active', isCelsius);
      btn.textContent = isCelsius ? '°C / °F' : '°F / °C';

      // Re-render everything
      updateCurrentWeather();
      renderFiveDayForecast();
      renderDailyForecast();
      renderHourlyForecast(currentHourlyDay);
      renderMonthlyCalendar();
      renderMonthlyTable();
      updateMonthlySummary();

      // Redraw active chart
      if (currentTab === 'harian' && typeof drawDailyChart === 'function') drawDailyChart();
      if (currentTab === 'per-jam' && typeof drawHourlyChart === 'function') drawHourlyChart(currentHourlyDay);
      if (currentTab === 'bulanan' && typeof drawMonthlyChart === 'function') drawMonthlyChart();
    });
  }

  function updateCurrentWeather() {
    var d = WEATHER_DATA.current;
    document.getElementById('current-temp').textContent = temp(d.temp);
    document.getElementById('current-feels').textContent = 'Terasa seperti ' + temp(d.feelsLike);
    document.getElementById('detail-high-low').textContent = temp(d.high) + ' / ' + temp(d.low);
    updateMonthlySummary();
  }

  function updateMonthlySummary() {
    var data = WEATHER_DATA.monthlyData.filter(function(d) { return d.high !== null; });
    var allTemps = [];
    var highs = [];
    var lows = [];
    data.forEach(function(d) {
      allTemps.push(d.high, d.low);
      highs.push(d.high);
      lows.push(d.low);
    });
    var avg = Math.round(allTemps.reduce(function(a, b) { return a + b; }, 0) / allTemps.length);
    var max = Math.max.apply(null, highs);
    var min = Math.min.apply(null, lows);

    var unitLetter = isCelsius ? 'C' : 'F';
    var avgEl = document.getElementById('summary-avg');
    var maxEl = document.getElementById('summary-max');
    var minEl = document.getElementById('summary-min');
    if (avgEl) avgEl.textContent = temp(avg) + unitLetter;
    if (maxEl) maxEl.textContent = temp(max);
    if (minEl) minEl.textContent = temp(min);
  }

  // ===== REFRESH =====
  function setupRefresh() {
    var btn = document.getElementById('btn-refresh');
    btn.addEventListener('click', function() {
      btn.style.transform = 'rotate(360deg)';
      btn.style.transition = 'transform 0.5s ease';
      setTimeout(function() {
        btn.style.transform = '';
      }, 500);
      // Simulate refresh - re-render
      renderFiveDayForecast();
      renderDailyForecast();
      renderHourlyForecast(currentHourlyDay);
    });
  }

  // ===== HAMBURGER =====
  function setupHamburger() {
    var hamburger = document.getElementById('hamburger');
    var mobileNav = document.getElementById('mobile-nav');

    hamburger.addEventListener('click', function() {
      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('hidden');
    });
  }

  // ===== HOURLY TABS =====
  function setupHourlyTabs() {
    document.querySelectorAll('.hourly-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.hourly-tab').forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');
        currentHourlyDay = this.dataset.day;
        window._currentHourlyDay = currentHourlyDay;
        renderHourlyForecast(currentHourlyDay);
        if (typeof drawHourlyChart === 'function') {
          setTimeout(function() { drawHourlyChart(currentHourlyDay); }, 100);
        }
      });
    });
  }

  // ===== RENDER: 5-DAY FORECAST =====
  function renderFiveDayForecast() {
    var container = document.getElementById('forecast-5day');
    var html = '';
    WEATHER_DATA.fiveDayForecast.forEach(function(day) {
      html += '<div class="forecast-card ' + (day.today ? 'today' : '') + '">';
      html += '  <div class="forecast-day">' + day.day + '</div>';
      html += '  <div class="forecast-date">' + day.date + '</div>';
      html += '  <img class="forecast-icon" src="' + day.icon + '" alt="' + day.condition + '">';
      html += '  <div class="forecast-temps">';
      html += '    <span class="forecast-high">' + temp(day.high) + '</span>';
      html += '    <span class="forecast-low">' + temp(day.low) + '</span>';
      html += '  </div>';
      html += '  <div class="forecast-condition">' + day.condition + '</div>';
      html += '</div>';
    });
    container.innerHTML = html;
  }

  // ===== RENDER: DAILY FORECAST (10-day) =====
  function renderDailyForecast() {
    var container = document.getElementById('daily-forecast-list');
    var data = WEATHER_DATA.dailyForecast;
    var allHighs = data.map(function(d) { return d.high; }).filter(Boolean);
    var allLows = data.map(function(d) { return d.low; }).filter(Boolean);
    var globalMin = Math.min.apply(null, allLows);
    var globalMax = Math.max.apply(null, allHighs);
    var range = globalMax - globalMin;

    var html = '';
    data.forEach(function(day) {
      var barLeft = ((day.low - globalMin) / range) * 100;
      var barWidth = ((day.high - day.low) / range) * 100;

      html += '<div class="daily-item ' + (day.today ? 'today-item' : '') + '">';
      html += '  <div class="daily-date-col">';
      html += '    <span class="daily-day-name">' + (day.today ? 'Hari Ini' : day.dayFull) + '</span>';
      html += '    <span class="daily-date-text">' + day.dateNum + ' Okt</span>';
      html += '  </div>';
      html += '  <img class="daily-icon" src="' + day.icon + '" alt="' + day.condition + '">';
      html += '  <span class="daily-condition">' + day.condition + '</span>';
      html += '  <span class="daily-high">' + temp(day.high) + '</span>';
      html += '  <div class="daily-bar"><div class="daily-bar-fill" style="margin-left:' + barLeft + '%;width:' + barWidth + '%"></div></div>';
      html += '  <span class="daily-low">' + temp(day.low) + '</span>';
      // Mobile-only combined temps
      html += '  <div class="daily-temps-mobile">';
      html += '    <span class="daily-high">' + temp(day.high) + '</span>';
      html += '    <span style="color:var(--text-muted)">/</span>';
      html += '    <span class="daily-low">' + temp(day.low) + '</span>';
      html += '  </div>';
      html += '</div>';
    });
    container.innerHTML = html;
  }

  // ===== RENDER: HOURLY FORECAST =====
  function renderHourlyForecast(day) {
    var container = document.getElementById('hourly-timeline');
    var data = WEATHER_DATA.hourlyForecast[day];
    if (!data) return;

    var html = '';
    data.forEach(function(hour) {
      var iconUrl = 'https://www.accuweather.com/images/weathericons/v2a/' + hour.icon + '.svg';
      var isCurrent = (day === 'today' && hour.time === '13:00');
      html += '<div class="hourly-item ' + (isCurrent ? 'current-hour' : '') + '">';
      html += '  <div class="hourly-time">' + hour.time + '</div>';
      html += '  <img class="hourly-icon" src="' + iconUrl + '" alt="' + hour.condition + '">';
      html += '  <div class="hourly-temp">' + temp(hour.temp) + '</div>';
      html += '  <div class="hourly-rain">💧 ' + hour.rain + '%</div>';
      html += '</div>';
    });
    container.innerHTML = html;
  }

  // ===== RENDER: MONTHLY CALENDAR =====
  function renderMonthlyCalendar() {
    var container = document.getElementById('monthly-calendar');
    var data = WEATHER_DATA.monthlyData;
    var headers = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    var startDay = 3; // 1 Oktober 2026 = Kamis (0=Sen, 3=Kam)

    var html = '';
    // Headers
    headers.forEach(function(h) {
      html += '<div class="cal-header">' + h + '</div>';
    });

    // Empty cells before start
    for (var i = 0; i < startDay; i++) {
      html += '<div class="cal-day empty"></div>';
    }

    // Days
    data.forEach(function(day) {
      var iconUrl = day.icon === 'na'
        ? ''
        : 'https://www.accuweather.com/images/weathericons/v2a/' + day.icon + '.svg';

      html += '<div class="cal-day ' + (day.today ? 'today-cal' : '') + '">';
      html += '  <span class="cal-day-num">' + day.date + '</span>';
      if (iconUrl) {
        html += '  <img class="cal-day-icon" src="' + iconUrl + '" alt="' + day.condition + '">';
      }
      if (day.high !== null) {
        html += '  <span class="cal-day-temps">' + temp(day.high) + ' / ' + temp(day.low) + '</span>';
      } else {
        html += '  <span class="cal-day-temps" style="color:var(--text-muted)">N/A</span>';
      }
      html += '</div>';
    });

    container.innerHTML = html;
  }

  // ===== RENDER: MONTHLY TABLE =====
  function renderMonthlyTable() {
    var tbody = document.getElementById('monthly-table-body');
    var data = WEATHER_DATA.monthlyData;
    var html = '';

    data.forEach(function(day) {
      var iconUrl = day.icon === 'na'
        ? ''
        : 'https://www.accuweather.com/images/weathericons/v2a/' + day.icon + '.svg';

      html += '<tr ' + (day.today ? 'style="background:rgba(59,130,246,0.06)"' : '') + '>';
      html += '  <td><strong>' + day.date + ' Oktober</strong></td>';
      html += '  <td>' + day.day + '</td>';
      if (iconUrl) {
        html += '  <td><img class="table-icon" src="' + iconUrl + '" alt="' + day.condition + '"></td>';
      } else {
        html += '  <td>—</td>';
      }
      html += '  <td>' + (day.high !== null ? temp(day.high) : 'N/A') + '</td>';
      html += '  <td>' + (day.low !== null ? temp(day.low) : 'N/A') + '</td>';
      html += '  <td>' + day.condition + '</td>';
      html += '</tr>';
    });

    tbody.innerHTML = html;
  }

  // ===== COMFORT GAUGES =====
  function animateComfortGauges() {
    setTimeout(function() {
      document.querySelectorAll('.comfort-gauge').forEach(function(gauge) {
        var value = parseInt(gauge.dataset.value);
        var color = gauge.dataset.color;
        var circumference = 2 * Math.PI * 45; // r=45
        var offset = circumference - (value / 100) * circumference;

        var fill = gauge.querySelector('.gauge-fill');
        if (fill) {
          fill.style.stroke = color;
          fill.style.strokeDasharray = circumference;
          fill.style.strokeDashoffset = offset;
        }
      });
    }, 300);
  }

  // Make temp function globally available for charts
  window.tempVal = tempVal;
  window.temp = temp;
  window.isCelsius = function() { return isCelsius; };

})();