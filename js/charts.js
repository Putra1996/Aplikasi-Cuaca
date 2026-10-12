/**
 * Responsive, dependency-free Canvas charts.
 * Values remain Fahrenheit in WEATHER_DATA; labels convert from the active UI unit.
 */
(function () {
  'use strict';

  var COLORS = {
    high: '#f59e0b',
    low: '#60a5fa',
    rain: '#38bdf8',
    grid: 'rgba(148,163,184,0.16)',
    text: '#94a3b8',
    bright: '#f8fafc'
  };

  function setupCanvas(canvas, fallbackHeight) {
    var rect = canvas.getBoundingClientRect();
    var width = Math.max(320, Math.round(rect.width || Number(canvas.getAttribute('width')) || 900));
    var height = Math.max(200, Math.round(rect.height || fallbackHeight || Number(canvas.getAttribute('height')) || 350));
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx: ctx, width: width, height: height };
  }

  function valueInActiveUnit(valueF) {
    return window.isCelsius() ? WEATHER_DATA.toCelsius(valueF) : Math.round(valueF);
  }

  function colorWithAlpha(color, alpha) {
    var hex = color.replace('#', '');
    if (hex.length !== 6) return color;
    var r = parseInt(hex.slice(0, 2), 16);
    var g = parseInt(hex.slice(2, 4), 16);
    var b = parseInt(hex.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function drawGrid(ctx, left, right, top, bottom, min, max, steps, formatter) {
    ctx.font = '11px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (var i = 0; i <= steps; i++) {
      var ratio = i / steps;
      var y = bottom - ratio * (bottom - top);
      var value = min + ratio * (max - min);
      ctx.beginPath();
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(formatter ? formatter(value) : String(Math.round(value)), left - 9, y);
    }
  }

  function drawXAxis(ctx, labels, points, y, every) {
    ctx.font = '10px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.text;
    labels.forEach(function (label, index) {
      if (index % every !== 0 && index !== labels.length - 1) return;
      ctx.fillText(label, points[index].x, y);
    });
  }

  function line(ctx, points, color, lineWidth) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function fillArea(ctx, points, color, baseY) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, baseY);
    points.forEach(function (point) { ctx.lineTo(point.x, point.y); });
    ctx.lineTo(points[points.length - 1].x, baseY);
    ctx.closePath();
    var gradient = ctx.createLinearGradient(0, points.reduce(function (m, p) { return Math.min(m, p.y); }, baseY), 0, baseY);
    gradient.addColorStop(0, colorWithAlpha(color, 0.24));
    gradient.addColorStop(1, colorWithAlpha(color, 0.015));
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  function dots(ctx, points, color, radius) {
    points.forEach(function (point) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius || 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(point.x, point.y, (radius || 3) + 2, 0, Math.PI * 2);
      ctx.strokeStyle = colorWithAlpha(color, 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  function legend(ctx, items, width) {
    var startX = Math.max(110, width - items.reduce(function (sum, item) { return sum + item.width; }, 0) - 22);
    var x = startX;
    var y = 20;
    ctx.font = '11px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    items.forEach(function (item) {
      ctx.fillStyle = item.color;
      if (item.type === 'line') {
        ctx.fillRect(x, y - 2, 14, 4);
      } else {
        ctx.fillRect(x, y - 5, 10, 10);
      }
      ctx.fillStyle = COLORS.bright;
      ctx.fillText(item.label, x + 17, y);
      x += item.width;
    });
  }

  function chartGeometry(width, height, leftPad) {
    var padding = { top: 46, right: 24, bottom: 38, left: leftPad || 55 };
    return {
      left: padding.left,
      right: Math.max(padding.left + 1, width - padding.right),
      top: padding.top,
      bottom: Math.max(padding.top + 1, height - padding.bottom),
      width: Math.max(1, width - padding.left - padding.right),
      height: Math.max(1, height - padding.top - padding.bottom)
    };
  }

  window.drawDailyChart = function () {
    var canvas = document.getElementById('daily-temp-chart');
    if (!canvas) return;
    var setup = setupCanvas(canvas, 350);
    if (!setup) return;
    var ctx = setup.ctx;
    var data = WEATHER_DATA.dailyForecast.filter(function (day) { return Number.isFinite(day.high) && Number.isFinite(day.low); });
    if (!data.length) return;
    var highs = data.map(function (day) { return valueInActiveUnit(day.high); });
    var lows = data.map(function (day) { return valueInActiveUnit(day.low); });
    var all = highs.concat(lows);
    var min = Math.floor(Math.min.apply(null, all) - 2);
    var max = Math.ceil(Math.max.apply(null, all) + 2);
    if (max <= min) max = min + 1;
    var geo = chartGeometry(setup.width, setup.height, 58);
    drawGrid(ctx, geo.left, geo.right, geo.top, geo.bottom, min, max, 4, function (value) { return Math.round(value) + (window.weatherUnit ? window.weatherUnit() : '°'); });
    var step = data.length > 1 ? geo.width / (data.length - 1) : 0;
    var x = data.map(function (_, index) { return geo.left + step * index; });
    var toPoints = function (values) { return values.map(function (value, index) { return { x: x[index], y: geo.bottom - ((value - min) / (max - min)) * geo.height }; }); };
    var highPoints = toPoints(highs);
    var lowPoints = toPoints(lows);
    fillArea(ctx, highPoints, COLORS.high, geo.bottom);
    fillArea(ctx, lowPoints, COLORS.low, geo.bottom);
    line(ctx, highPoints, COLORS.high, 2.5);
    line(ctx, lowPoints, COLORS.low, 2.5);
    dots(ctx, highPoints, COLORS.high, 3);
    dots(ctx, lowPoints, COLORS.low, 3);
    drawXAxis(ctx, data.map(function (day) { return String(day.dateNum); }), x.map(function (xPos) { return { x: xPos }; }), geo.bottom + 10, 1);
    legend(ctx, [{ label: 'Tertinggi', color: COLORS.high, width: 89 }, { label: 'Terendah', color: COLORS.low, width: 83 }], setup.width);
    canvas.setAttribute('aria-label', 'Grafik suhu maksimum dan minimum 10 hari dalam ' + (window.weatherUnit ? window.weatherUnit() : 'satuan aktif'));
  };

  window.drawHourlyChart = function (dayKey) {
    var canvas = document.getElementById('hourly-temp-chart');
    if (!canvas) return;
    var setup = setupCanvas(canvas, 300);
    if (!setup) return;
    var data = WEATHER_DATA.hourlyForecast[dayKey];
    if (!Array.isArray(data) || !data.length) return;
    var ctx = setup.ctx;
    var temps = data.map(function (hour) { return valueInActiveUnit(hour.temp); });
    var min = Math.floor(Math.min.apply(null, temps) - 2);
    var max = Math.ceil(Math.max.apply(null, temps) + 2);
    if (max <= min) max = min + 1;
    var geo = chartGeometry(setup.width, setup.height, 56);
    drawGrid(ctx, geo.left, geo.right, geo.top, geo.bottom, min, max, 4, function (value) { return Math.round(value) + (window.weatherUnit ? window.weatherUnit() : '°'); });
    var step = data.length > 1 ? geo.width / (data.length - 1) : 0;
    var x = data.map(function (_, index) { return geo.left + step * index; });
    var points = temps.map(function (value, index) { return { x: x[index], y: geo.bottom - ((value - min) / (max - min)) * geo.height }; });
    data.forEach(function (hour, index) {
      var barWidth = Math.max(3, Math.min(12, step * 0.42));
      var barHeight = Math.max(0, Math.min(100, Number(hour.rain) || 0)) / 100 * geo.height * 0.42;
      ctx.fillStyle = 'rgba(56,189,248,0.28)';
      ctx.fillRect(x[index] - barWidth / 2, geo.bottom - barHeight, barWidth, barHeight);
    });
    fillArea(ctx, points, COLORS.high, geo.bottom);
    line(ctx, points, COLORS.high, 2.5);
    dots(ctx, points, COLORS.high, 2.5);
    var xPoints = x.map(function (xPos) { return { x: xPos }; });
    drawXAxis(ctx, data.map(function (hour) { return hour.time.slice(0, 2); }), xPoints, geo.bottom + 10, 3);
    legend(ctx, [{ label: 'Suhu', color: COLORS.high, width: 61, type: 'line' }, { label: 'Hujan %', color: COLORS.rain, width: 83 }], setup.width);
    canvas.setAttribute('aria-label', 'Grafik suhu dan peluang hujan per jam, ' + (dayKey === 'tomorrow' ? 'besok' : 'hari ini'));
  };

  function drawConnectedSegments(ctx, points, color, width) {
    var segment = [];
    function flush() {
      if (segment.length > 1) line(ctx, segment, color, width);
      segment = [];
    }
    points.forEach(function (point) {
      if (point) segment.push(point);
      else flush();
    });
    flush();
  }

  function drawTemperatureBands(ctx, highs, lows) {
    var highSegment = [];
    var lowSegment = [];
    function flush() {
      if (highSegment.length > 1 && lowSegment.length === highSegment.length) {
        ctx.beginPath();
        ctx.moveTo(highSegment[0].x, highSegment[0].y);
        highSegment.forEach(function (point) { ctx.lineTo(point.x, point.y); });
        for (var i = lowSegment.length - 1; i >= 0; i--) ctx.lineTo(lowSegment[i].x, lowSegment[i].y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(96,165,250,0.11)';
        ctx.fill();
      }
      highSegment = [];
      lowSegment = [];
    }
    for (var index = 0; index < highs.length; index++) {
      if (!highs[index] || !lows[index]) flush();
      else {
        highSegment.push(highs[index]);
        lowSegment.push(lows[index]);
      }
    }
    flush();
  }

  window.drawMonthlyChart = function (mode) {
    var canvas = document.getElementById('monthly-temp-chart');
    if (!canvas) return;
    var setup = setupCanvas(canvas, 350);
    if (!setup) return;
    var data = WEATHER_DATA.monthlyData;
    if (!data.length) return;
    var ctx = setup.ctx;
    var geo = chartGeometry(setup.width, setup.height, 58);
    var step = data.length > 1 ? geo.width / (data.length - 1) : 0;
    var x = data.map(function (_, index) { return geo.left + step * index; });
    var xPoints = x.map(function (xPos) { return { x: xPos }; });
    var labels = data.map(function (day) { return String(day.date); });
    var xStride = setup.width < 560 ? 7 : 5;

    if (mode === 'rain') {
      drawGrid(ctx, geo.left, geo.right, geo.top, geo.bottom, 0, 100, 4, function (value) { return Math.round(value) + '%'; });
      var rainPoints = data.map(function (day, index) {
        if (!Number.isFinite(day.rain)) return null;
        var chance = Math.max(0, Math.min(100, Number(day.rain)));
        return { x: x[index], y: geo.bottom - chance / 100 * geo.height, value: chance };
      });
      var barWidth = Math.max(2, Math.min(14, step * 0.52));
      rainPoints.forEach(function (point, index) {
        if (!point) return;
        ctx.fillStyle = 'rgba(56,189,248,0.35)';
        ctx.fillRect(point.x - barWidth / 2, point.y, barWidth, geo.bottom - point.y);
      });
      drawConnectedSegments(ctx, rainPoints, COLORS.rain, 2.5);
      dots(ctx, rainPoints.filter(Boolean), COLORS.rain, 2.1);
      drawXAxis(ctx, labels, xPoints, geo.bottom + 10, xStride);
      legend(ctx, [{ label: 'Peluang hujan', color: COLORS.rain, width: 125, type: 'line' }], setup.width);
      canvas.setAttribute('aria-label', 'Grafik peluang hujan harian sepanjang Oktober 2026; celah menandai hari tanpa data');
      return;
    }

    var highs = data.map(function (day) { return Number.isFinite(day.high) ? valueInActiveUnit(day.high) : null; });
    var lows = data.map(function (day) { return Number.isFinite(day.low) ? valueInActiveUnit(day.low) : null; });
    var all = highs.concat(lows).filter(Number.isFinite);
    if (!all.length) return;
    var min = Math.floor(Math.min.apply(null, all) - 2);
    var max = Math.ceil(Math.max.apply(null, all) + 2);
    if (max <= min) max = min + 1;
    drawGrid(ctx, geo.left, geo.right, geo.top, geo.bottom, min, max, 4, function (value) { return Math.round(value) + (window.weatherUnit ? window.weatherUnit() : '°'); });
    function toPoints(values) {
      return values.map(function (value, index) {
        if (!Number.isFinite(value)) return null;
        return { x: x[index], y: geo.bottom - ((value - min) / (max - min)) * geo.height };
      });
    }
    var highPoints = toPoints(highs);
    var lowPoints = toPoints(lows);
    drawTemperatureBands(ctx, highPoints, lowPoints);
    drawConnectedSegments(ctx, highPoints, COLORS.high, 2.2);
    drawConnectedSegments(ctx, lowPoints, COLORS.low, 2.2);
    dots(ctx, highPoints.filter(Boolean), COLORS.high, 1.8);
    dots(ctx, lowPoints.filter(Boolean), COLORS.low, 1.8);
    drawXAxis(ctx, labels, xPoints, geo.bottom + 10, xStride);
    legend(ctx, [{ label: 'Tertinggi', color: COLORS.high, width: 89 }, { label: 'Terendah', color: COLORS.low, width: 83 }], setup.width);
    canvas.setAttribute('aria-label', 'Grafik suhu tertinggi dan terendah setiap hari Oktober 2026; celah menandai hari tanpa data');
  };

  var resizeTimeout;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(function () {
      var tab = window.currentWeatherTab ? window.currentWeatherTab() : '';
      if (tab === 'harian') window.drawDailyChart();
      if (tab === 'per-jam') window.drawHourlyChart(window._currentHourlyDay || 'today');
      if (tab === 'bulanan' && !document.getElementById('monthly-data-view').classList.contains('hidden')) window.drawMonthlyChart(window._currentMonthlyChartMode || 'temperature');
      if (tab === 'radar' && window.drawRadar) window.drawRadar();
    }, 160);
  });
})();
