/**
 * Lightweight schematized radar demonstrator (Canvas API; no external map tiles).
 * It intentionally does not pretend to be a live radar product.
 */
(function () {
  'use strict';

  var canvas;
  var frameSlider;
  var frameIndex = WEATHER_DATA.radarFrames.length - 1;
  var zoom = 1;
  var panX = 0;
  var panY = 0;
  var dragging = false;
  var dragOrigin = null;
  var playTimer = null;
  var initialized = false;

  function roundedLabel(ctx, text, x, y, options) {
    var settings = options || {};
    ctx.font = settings.font || '600 12px Plus Jakarta Sans, sans-serif';
    var paddingX = settings.paddingX || 8;
    var width = ctx.measureText(text).width + paddingX * 2;
    var height = settings.height || 24;
    ctx.fillStyle = settings.background || 'rgba(255,255,255,0.78)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x - width / 2, y - height / 2, width, height, 8);
    else ctx.rect(x - width / 2, y - height / 2, width, height);
    ctx.fill();
    ctx.fillStyle = settings.color || '#263449';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  function drawRoad(ctx, points, width, color, dash) {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawBaseMap(ctx, width, height) {
    var bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#dcebd6');
    bg.addColorStop(0.48, '#e9efd9');
    bg.addColorStop(1, '#d7e7d2');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Stylized, explicitly schematic land and hill regions.
    ctx.fillStyle = 'rgba(93,153,103,0.16)';
    ctx.beginPath();
    ctx.moveTo(width * 0.02, height * 0.11);
    ctx.bezierCurveTo(width * 0.21, height * 0.01, width * 0.29, height * 0.25, width * 0.45, height * 0.2);
    ctx.bezierCurveTo(width * 0.54, height * 0.17, width * 0.6, height * 0.03, width * 0.74, height * 0.1);
    ctx.lineTo(width * 0.76, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(79,139,90,0.12)';
    ctx.beginPath();
    ctx.moveTo(width * 0.55, height);
    ctx.bezierCurveTo(width * 0.61, height * 0.75, width * 0.75, height * 0.82, width * 0.9, height * 0.7);
    ctx.lineTo(width, height * 0.77);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Subtle contour-like arcs.
    for (var contour = 0; contour < 5; contour++) {
      ctx.beginPath();
      ctx.ellipse(width * (0.17 + contour * 0.035), height * (0.24 + contour * 0.018), width * (0.1 + contour * 0.017), height * (0.07 + contour * 0.012), -0.25, 0.2, Math.PI * 1.62);
      ctx.strokeStyle = 'rgba(77,132,86,0.19)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // A schematic river and road network; these are decorative, not geospatial data.
    drawRoad(ctx, [[-20, height * 0.77], [width * 0.18, height * 0.65], [width * 0.31, height * 0.7], [width * 0.48, height * 0.53], [width * 0.67, height * 0.57], [width + 20, height * 0.34]], 12, 'rgba(255,255,255,0.72)');
    drawRoad(ctx, [[-20, height * 0.77], [width * 0.18, height * 0.65], [width * 0.31, height * 0.7], [width * 0.48, height * 0.53], [width * 0.67, height * 0.57], [width + 20, height * 0.34]], 4, '#f3b85d');
    drawRoad(ctx, [[width * 0.14, -20], [width * 0.21, height * 0.24], [width * 0.38, height * 0.42], [width * 0.48, height * 0.53], [width * 0.57, height * 0.8], [width * 0.64, height + 20]], 8, 'rgba(255,255,255,0.8)');
    drawRoad(ctx, [[width * 0.14, -20], [width * 0.21, height * 0.24], [width * 0.38, height * 0.42], [width * 0.48, height * 0.53], [width * 0.57, height * 0.8], [width * 0.64, height + 20]], 2.5, '#f6fbf0');
    drawRoad(ctx, [[width * 0.91, -10], [width * 0.81, height * 0.2], [width * 0.75, height * 0.42], [width * 0.67, height * 0.57]], 2, 'rgba(255,255,255,0.88)', [5, 6]);

    ctx.beginPath();
    ctx.moveTo(width * 0.02, height * 0.33);
    ctx.bezierCurveTo(width * 0.18, height * 0.28, width * 0.22, height * 0.48, width * 0.39, height * 0.42);
    ctx.bezierCurveTo(width * 0.57, height * 0.35, width * 0.68, height * 0.48, width * 0.83, height * 0.36);
    ctx.bezierCurveTo(width * 0.91, height * 0.3, width * 0.96, height * 0.36, width * 1.02, height * 0.33);
    ctx.strokeStyle = 'rgba(71,151,194,0.67)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.62)';
    ctx.lineWidth = 1;
    ctx.stroke();

    roundedLabel(ctx, 'Sungai (skematis)', width * 0.76, height * 0.33, { font: '500 10px Plus Jakarta Sans, sans-serif', height: 20, color: '#397795' });
    roundedLabel(ctx, 'Jalur utama (skematis)', width * 0.28, height * 0.72, { font: '500 10px Plus Jakarta Sans, sans-serif', height: 20, color: '#76572c' });

    // Coordinate-like grid helps convey map orientation without claiming street accuracy.
    ctx.strokeStyle = 'rgba(71,85,105,0.11)';
    ctx.lineWidth = 1;
    for (var gx = 1; gx < 5; gx++) {
      ctx.beginPath(); ctx.moveTo(width * gx / 5, 0); ctx.lineTo(width * gx / 5, height); ctx.stroke();
    }
    for (var gy = 1; gy < 4; gy++) {
      ctx.beginPath(); ctx.moveTo(0, height * gy / 4); ctx.lineTo(width, height * gy / 4); ctx.stroke();
    }
  }

  function drawCloudLayer(ctx, width, height, frame) {
    var cloudShift = frame * width * 0.018;
    [
      { x: 0.24, y: 0.31, radius: 0.19 },
      { x: 0.72, y: 0.38, radius: 0.15 },
      { x: 0.43, y: 0.79, radius: 0.2 }
    ].forEach(function (cloud) {
      var x = width * cloud.x + cloudShift;
      var y = height * cloud.y;
      var radius = Math.min(width, height) * cloud.radius;
      var gradient = ctx.createRadialGradient(x, y, radius * 0.12, x, y, radius);
      gradient.addColorStop(0, 'rgba(255,255,255,0.25)');
      gradient.addColorStop(0.58, 'rgba(226,232,240,0.14)');
      gradient.addColorStop(1, 'rgba(226,232,240,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawRainLayer(ctx, width, height, frameData) {
    (frameData.cells || []).forEach(function (cell) {
      var x = cell.x * width;
      var y = cell.y * height;
      var radius = Math.min(width, height) * cell.radius;
      var intensity = Math.max(0, Math.min(1, Number(cell.intensity) || 0));
      var color = intensity >= 0.65 ? [239, 68, 68] : intensity >= 0.45 ? [234, 179, 8] : intensity >= 0.3 ? [34, 197, 94] : [59, 130, 246];
      var gradient = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
      gradient.addColorStop(0, 'rgba(' + color.join(',') + ',' + (0.35 + intensity * 0.22) + ')');
      gradient.addColorStop(0.45, 'rgba(' + color.join(',') + ',' + (0.26 + intensity * 0.14) + ')');
      gradient.addColorStop(1, 'rgba(' + color.join(',') + ',0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  function drawLocationMarker(ctx, width, height) {
    var x = width * 0.51;
    var y = height * 0.52;
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15,23,42,0.16)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#2563eb';
    ctx.fill();
    roundedLabel(ctx, 'Klumprit', x, y - 27, { font: '700 12px Plus Jakarta Sans, sans-serif', color: '#172033' });
  }

  function render() {
    if (!canvas) canvas = document.getElementById('radar-canvas');
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var width = Math.max(300, Math.round(rect.width || 960));
    var height = Math.max(240, Math.round(rect.height || 560));
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2 + panX, height / 2 + panY);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);
    drawBaseMap(ctx, width, height);
    var frameData = WEATHER_DATA.radarFrames[Math.max(0, Math.min(frameIndex, WEATHER_DATA.radarFrames.length - 1))];
    var cloudToggle = document.getElementById('radar-layer-cloud');
    var rainToggle = document.getElementById('radar-layer-rain');
    if (!cloudToggle || cloudToggle.checked) drawCloudLayer(ctx, width, height, frameIndex);
    if (!rainToggle || rainToggle.checked) drawRainLayer(ctx, width, height, frameData);
    drawLocationMarker(ctx, width, height);
    ctx.restore();

    // Compass mark and frame label are screen-fixed while the map can be panned.
    ctx.save();
    ctx.translate(width - 30, 31);
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.font = '700 11px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -2);
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(-4, 12); ctx.lineTo(0, 10); ctx.lineTo(4, 12); ctx.closePath(); ctx.fill();
    ctx.restore();

    var label = document.getElementById('radar-frame-label');
    var timeCurrent = document.getElementById('radar-time-current');
    var chosen = document.getElementById('radar-timeline');
    if (label) label.textContent = frameData.label;
    if (timeCurrent) timeCurrent.textContent = frameData.label;
    if (chosen && Number(chosen.value) !== frameIndex) chosen.value = String(frameIndex);
    canvas.setAttribute('aria-label', 'Peta skematis sekitar Klumprit; lapisan presipitasi simulasi, bingkai ' + frameData.label + '. Geser untuk menjelajah.');
  }

  function setZoom(nextZoom) {
    zoom = Math.max(0.75, Math.min(2.4, nextZoom));
    render();
  }

  function stopPlayback() {
    if (playTimer) window.clearInterval(playTimer);
    playTimer = null;
    var button = document.getElementById('radar-play');
    if (button) {
      button.textContent = '▶ Putar simulasi';
      button.setAttribute('aria-pressed', 'false');
    }
  }

  function setup() {
    if (initialized) return;
    initialized = true;
    canvas = document.getElementById('radar-canvas');
    frameSlider = document.getElementById('radar-timeline');
    if (!canvas) return;

    if (frameSlider) frameSlider.addEventListener('input', function () {
      frameIndex = Number(frameSlider.value) || 0;
      render();
    });
    var play = document.getElementById('radar-play');
    if (play) play.addEventListener('click', function () {
      if (playTimer) {
        stopPlayback();
        return;
      }
      play.textContent = '⏸ Jeda simulasi';
      play.setAttribute('aria-pressed', 'true');
      playTimer = window.setInterval(function () {
        frameIndex = (frameIndex + 1) % WEATHER_DATA.radarFrames.length;
        render();
      }, 950);
    });

    var zoomIn = document.getElementById('radar-zoom-in');
    var zoomOut = document.getElementById('radar-zoom-out');
    var center = document.getElementById('radar-center');
    if (zoomIn) zoomIn.addEventListener('click', function () { setZoom(zoom + 0.2); });
    if (zoomOut) zoomOut.addEventListener('click', function () { setZoom(zoom - 0.2); });
    if (center) center.addEventListener('click', function () { zoom = 1; panX = 0; panY = 0; render(); });
    ['radar-layer-rain', 'radar-layer-cloud'].forEach(function (id) {
      var layer = document.getElementById(id);
      if (layer) layer.addEventListener('change', render);
    });

    canvas.addEventListener('pointerdown', function (event) {
      dragging = true;
      dragOrigin = { x: event.clientX, y: event.clientY, panX: panX, panY: panY };
      canvas.classList.add('is-dragging');
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', function (event) {
      if (!dragging || !dragOrigin) return;
      panX = dragOrigin.panX + event.clientX - dragOrigin.x;
      panY = dragOrigin.panY + event.clientY - dragOrigin.y;
      render();
    });
    function endDrag() {
      dragging = false;
      dragOrigin = null;
      canvas.classList.remove('is-dragging');
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('lostpointercapture', endDrag);
    canvas.addEventListener('wheel', function (event) {
      event.preventDefault();
      setZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1));
    }, { passive: false });
    window.addEventListener('resize', render);
    render();
  }

  window.drawRadar = render;
  window.stopRadarPlayback = stopPlayback;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
