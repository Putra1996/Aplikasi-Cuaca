/**
 * Charts Module - Canvas-based charts for Aplikasi Cuaca
 * No external dependencies - pure Canvas API
 */

(function() {
  'use strict';

  var COLORS = {
    high: '#f59e0b',
    low: '#3b82f6',
    rain: '#60a5fa',
    grid: 'rgba(255,255,255,0.06)',
    text: '#94a3b8',
    textBright: '#f8fafc',
    bg: 'transparent'
  };

  function getDevicePixelRatio() {
    return window.devicePixelRatio || 1;
  }

  function setupCanvas(canvas) {
    var dpr = getDevicePixelRatio();
    var rect = canvas.getBoundingClientRect();
    var w = rect.width || parseInt(canvas.getAttribute('width')) || 900;
    var h = rect.height || parseInt(canvas.getAttribute('height')) || 350;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx: ctx, w: w, h: h };
  }

  function tempDisplay(f) {
    return window.isCelsius() ? WEATHER_DATA.toCelsius(f) : f;
  }

  function drawLine(ctx, points, color, lineWidth) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  function drawArea(ctx, points, color, baseY) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, baseY);
    for (var i = 0; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, baseY);
    ctx.closePath();

    var gradient = ctx.createLinearGradient(0, 0, 0, baseY);
    gradient.addColorStop(0, color.replace(')', ',0.3)').replace('rgb', 'rgba'));
    gradient.addColorStop(1, color.replace(')', ',0.02)').replace('rgb', 'rgba'));
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  function drawDots(ctx, points, color, radius) {
    points.forEach(function(p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius || 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, (radius || 3.5) + 2, 0, Math.PI * 2);
      ctx.strokeStyle = color.replace(')', ',0.3)').replace('rgb', 'rgba');
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  function drawLabels(ctx, labels, xPositions, y, color) {
    ctx.fillStyle = color || COLORS.text;
    ctx.font = '11px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    labels.forEach(function(label, i) {
      ctx.fillText(label, xPositions[i], y);
    });
  }

  function drawYLabels(ctx, values, yPositions, x, color) {
    ctx.fillStyle = color || COLORS.text;
    ctx.font = '10px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'right';
    values.forEach(function(val, i) {
      ctx.fillText(val + '°', x, yPositions[i] + 4);
    });
  }

  function drawGridLines(ctx, yPositions, x1, x2) {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    yPositions.forEach(function(y) {
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    });
  }

  // ===== DAILY CHART =====
  window.drawDailyChart = function() {
    var canvas = document.getElementById('daily-temp-chart');
    if (!canvas) return;

    var setup = setupCanvas(canvas);
    var ctx = setup.ctx;
    var w = setup.w;
    var h = setup.h;

    var data = WEATHER_DATA.dailyForecast;
    var highs = data.map(function(d) { return tempDisplay(d.high); });
    var lows = data.map(function(d) { return tempDisplay(d.low); });

    var padding = { top: 40, right: 40, bottom: 50, left: 50 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    var allTemps = highs.concat(lows);
    var minTemp = Math.min.apply(null, allTemps) - 3;
    var maxTemp = Math.max.apply(null, allTemps) + 3;
    var tempRange = maxTemp - minTemp;

    // Grid lines
    var gridSteps = 5;
    var yPositions = [];
    var yValues = [];
    for (var i = 0; i <= gridSteps; i++) {
      var val = Math.round(minTemp + (tempRange / gridSteps) * i);
      yPositions.push(padding.top + chartH - (chartH / gridSteps) * i);
      yValues.push(val);
    }
    drawGridLines(ctx, yPositions, padding.left, w - padding.right);
    drawYLabels(ctx, yValues, yPositions, padding.left - 8);

    // X positions
    var xPositions = [];
    var labels = [];
    data.forEach(function(d, idx) {
      xPositions.push(padding.left + (chartW / (data.length - 1)) * idx);
      labels.push(d.dateNum + ' Okt');
    });

    // Draw labels
    drawLabels(ctx, labels, xPositions, h - 15);

    // Calculate points
    function toPoints(values) {
      return values.map(function(val, idx) {
        return {
          x: xPositions[idx],
          y: padding.top + chartH - ((val - minTemp) / tempRange) * chartH
        };
      });
    }

    var highPoints = toPoints(highs);
    var lowPoints = toPoints(lows);

    // Draw areas
    drawArea(ctx, highPoints, 'rgb(245, 158, 11)', padding.top + chartH);
    drawArea(ctx, lowPoints, 'rgb(59, 130, 246)', padding.top + chartH);

    // Draw lines
    drawLine(ctx, highPoints, COLORS.high, 2.5);
    drawLine(ctx, lowPoints, COLORS.low, 2.5);

    // Draw dots
    drawDots(ctx, highPoints, COLORS.high);
    drawDots(ctx, lowPoints, COLORS.low);

    // Value labels on dots
    ctx.font = 'bold 10px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    highPoints.forEach(function(p, idx) {
      ctx.fillStyle = COLORS.high;
      ctx.fillText(highs[idx] + '°', p.x, p.y - 12);
    });
    lowPoints.forEach(function(p, idx) {
      ctx.fillStyle = COLORS.low;
      ctx.fillText(lows[idx] + '°', p.x, p.y + 18);
    });

    // Legend
    var legendY = 20;
    ctx.fillStyle = COLORS.high;
    ctx.fillRect(w - 180, legendY - 6, 12, 12);
    ctx.fillStyle = COLORS.textBright;
    ctx.font = '11px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Suhu Tinggi', w - 163, legendY + 4);

    ctx.fillStyle = COLORS.low;
    ctx.fillRect(w - 85, legendY - 6, 12, 12);
    ctx.fillStyle = COLORS.textBright;
    ctx.fillText('Suhu Rendah', w - 68, legendY + 4);
  };

  // ===== HOURLY CHART =====
  window.drawHourlyChart = function(day) {
    var canvas = document.getElementById('hourly-temp-chart');
    if (!canvas) return;

    var setup = setupCanvas(canvas);
    var ctx = setup.ctx;
    var w = setup.w;
    var h = setup.h;

    var data = WEATHER_DATA.hourlyForecast[day];
    if (!data) return;

    var temps = data.map(function(d) { return tempDisplay(d.temp); });
    var rains = data.map(function(d) { return d.rain; });

    var padding = { top: 40, right: 40, bottom: 50, left: 50 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    var minTemp = Math.min.apply(null, temps) - 3;
    var maxTemp = Math.max.apply(null, temps) + 3;
    var tempRange = maxTemp - minTemp;

    // Grid
    var gridSteps = 4;
    var yPositions = [];
    var yValues = [];
    for (var i = 0; i <= gridSteps; i++) {
      var val = Math.round(minTemp + (tempRange / gridSteps) * i);
      yPositions.push(padding.top + chartH - (chartH / gridSteps) * i);
      yValues.push(val);
    }
    drawGridLines(ctx, yPositions, padding.left, w - padding.right);
    drawYLabels(ctx, yValues, yPositions, padding.left - 8);

    // X positions
    var xPositions = [];
    var labels = [];
    data.forEach(function(d, idx) {
      xPositions.push(padding.left + (chartW / (data.length - 1)) * idx);
      labels.push(d.time);
    });
    drawLabels(ctx, labels, xPositions, h - 15);

    // Rain bars
    var barWidth = Math.max(6, chartW / data.length * 0.4);
    rains.forEach(function(rain, idx) {
      var barH = (rain / 100) * chartH;
      var barX = xPositions[idx] - barWidth / 2;
      var barY = padding.top + chartH - barH;

      ctx.fillStyle = 'rgba(96, 165, 250, 0.15)';
      ctx.fillRect(barX, barY, barWidth, barH);
    });

    // Temperature line
    var tempPoints = temps.map(function(val, idx) {
      return {
        x: xPositions[idx],
        y: padding.top + chartH - ((val - minTemp) / tempRange) * chartH
      };
    });

    drawArea(ctx, tempPoints, 'rgb(245, 158, 11)', padding.top + chartH);
    drawLine(ctx, tempPoints, COLORS.high, 2.5);
    drawDots(ctx, tempPoints, COLORS.high, 3);

    // Value labels
    ctx.font = 'bold 9px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    tempPoints.forEach(function(p, idx) {
      ctx.fillStyle = COLORS.high;
      ctx.fillText(temps[idx] + '°', p.x, p.y - 10);
    });

    // Legend
    var legendY = 20;
    ctx.fillStyle = COLORS.high;
    ctx.fillRect(w - 200, legendY - 6, 12, 12);
    ctx.fillStyle = COLORS.textBright;
    ctx.font = '11px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Suhu', w - 183, legendY + 4);

    ctx.fillStyle = 'rgba(96, 165, 250, 0.4)';
    ctx.fillRect(w - 120, legendY - 6, 12, 12);
    ctx.fillStyle = COLORS.textBright;
    ctx.fillText('Hujan %', w - 103, legendY + 4);
  };

  // ===== MONTHLY CHART =====
  window.drawMonthlyChart = function() {
    var canvas = document.getElementById('monthly-temp-chart');
    if (!canvas) return;

    var setup = setupCanvas(canvas);
    var ctx = setup.ctx;
    var w = setup.w;
    var h = setup.h;

    var data = WEATHER_DATA.monthlyData.filter(function(d) { return d.high !== null; });
    var highs = data.map(function(d) { return tempDisplay(d.high); });
    var lows = data.map(function(d) { return tempDisplay(d.low); });

    var padding = { top: 40, right: 40, bottom: 50, left: 50 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    var allTemps = highs.concat(lows);
    var minTemp = Math.min.apply(null, allTemps) - 3;
    var maxTemp = Math.max.apply(null, allTemps) + 3;
    var tempRange = maxTemp - minTemp;

    // Grid
    var gridSteps = 5;
    var yPositions = [];
    var yValues = [];
    for (var i = 0; i <= gridSteps; i++) {
      var val = Math.round(minTemp + (tempRange / gridSteps) * i);
      yPositions.push(padding.top + chartH - (chartH / gridSteps) * i);
      yValues.push(val);
    }
    drawGridLines(ctx, yPositions, padding.left, w - padding.right);
    drawYLabels(ctx, yValues, yPositions, padding.left - 8);

    // X positions
    var xPositions = [];
    var labels = [];
    data.forEach(function(d, idx) {
      xPositions.push(padding.left + (chartW / (data.length - 1)) * idx);
      labels.push(d.date.toString());
    });
    drawLabels(ctx, labels, xPositions, h - 15);

    // Points
    function toPoints(values) {
      return values.map(function(val, idx) {
        return {
          x: xPositions[idx],
          y: padding.top + chartH - ((val - minTemp) / tempRange) * chartH
        };
      });
    }

    var highPoints = toPoints(highs);
    var lowPoints = toPoints(lows);

    // Fill between
    ctx.beginPath();
    ctx.moveTo(highPoints[0].x, highPoints[0].y);
    for (var i = 1; i < highPoints.length; i++) {
      ctx.lineTo(highPoints[i].x, highPoints[i].y);
    }
    for (var j = lowPoints.length - 1; j >= 0; j--) {
      ctx.lineTo(lowPoints[j].x, lowPoints[j].y);
    }
    ctx.closePath();
    var gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, 'rgba(245, 158, 11, 0.12)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.08)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Lines
    drawLine(ctx, highPoints, COLORS.high, 2);
    drawLine(ctx, lowPoints, COLORS.low, 2);

    // Dots
    drawDots(ctx, highPoints, COLORS.high, 2.5);
    drawDots(ctx, lowPoints, COLORS.low, 2.5);

    // Legend
    var legendY = 20;
    ctx.fillStyle = COLORS.high;
    ctx.fillRect(w - 180, legendY - 6, 12, 12);
    ctx.fillStyle = COLORS.textBright;
    ctx.font = '11px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Suhu Tinggi', w - 163, legendY + 4);

    ctx.fillStyle = COLORS.low;
    ctx.fillRect(w - 85, legendY - 6, 12, 12);
    ctx.fillStyle = COLORS.textBright;
    ctx.fillText('Suhu Rendah', w - 68, legendY + 4);
  };

  // Redraw on resize
  var resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      var activeTab = document.querySelector('.tab-content.active');
      if (!activeTab) return;
      var id = activeTab.id;
      if (id === 'tab-harian') drawDailyChart();
      if (id === 'tab-per-jam') drawHourlyChart(window._currentHourlyDay || 'today');
      if (id === 'tab-bulanan') drawMonthlyChart();
    }, 250);
  });

})();