/**
 * Stardust / Sparkles Canvas 2D Engine (Vanilla JS)
 * Adaptado de Originkit Sparkles a JavaScript puro para máximo rendimiento sin dependencias.
 * Peso: < 3 KB | Carga: Instantánea | FPS: 60 estables
 */
(function(window) {
  'use strict';

  function parseColorToRgba(input) {
    if (!input) return { r: 0, g: 0, b: 0, a: 1 };
    var str = input.trim();
    var rgbaMatch = str.match(
      /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i
    );
    if (rgbaMatch) {
      return {
        r: Math.max(0, Math.min(255, parseFloat(rgbaMatch[1]))) / 255,
        g: Math.max(0, Math.min(255, parseFloat(rgbaMatch[2]))) / 255,
        b: Math.max(0, Math.min(255, parseFloat(rgbaMatch[3]))) / 255,
        a: rgbaMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbaMatch[4]))) : 1
      };
    }
    var hex = str.replace(/^#/, '');
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: 1
      };
    }
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16) / 255,
        g: parseInt(hex[1] + hex[1], 16) / 255,
        b: parseInt(hex[2] + hex[2], 16) / 255,
        a: 1
      };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  function rgbaToCanvasColor(rgba) {
    var r = Math.round(rgba.r * 255);
    var g = Math.round(rgba.g * 255);
    var b = Math.round(rgba.b * 255);
    if (rgba.a === 1) return 'rgb(' + r + ',' + g + ',' + b + ')';
    return 'rgba(' + r + ',' + g + ',' + b + ',' + rgba.a + ')';
  }

  function mapFlickerUiToInternal(ui) {
    var clamped = Math.max(1, Math.min(10, ui));
    return 0.5 + ((clamped - 1) / 9) * 11.5;
  }

  function mapDensityUiToInternal(ui) {
    var clamped = Math.max(1, Math.min(10, ui));
    return 5 + ((clamped - 1) / 9) * 55;
  }

  function angleToDrift(angleDeg) {
    var rad = ((angleDeg - 90) * Math.PI) / 180;
    return { vx: Math.cos(rad), vy: Math.sin(rad) };
  }

  function initStardustBackground(containerId, options) {
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return null;

    options = options || {};
    var bgHex = options.background || '#05070e';
    var particleColorHex = options.particleColor || '#ffffff';
    var particleDensity = options.particleDensity !== undefined ? options.particleDensity : 1.2;
    var minSize = options.minSize !== undefined ? options.minSize : 0.4;
    var maxSize = options.maxSize !== undefined ? options.maxSize : 1.2;
    var speed = options.speed !== undefined ? options.speed : 6;
    var particleSpeed = options.particleSpeed !== undefined ? options.particleSpeed : 0;
    var movement = options.movement !== undefined ? options.movement : 2.5;
    var angle = options.angle !== undefined ? options.angle : 180;

    // Crear canvas interno
    container.innerHTML = '';
    var canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var particles = [];
    var animationId = null;

    function initParticles(width, height) {
      particles = [];
      var area = width * height;
      var mappedDensity = mapDensityUiToInternal(particleDensity);
      var count = Math.floor((area / 10000) * mappedDensity);
      var velocityMultiplier = (particleSpeed / 10) * 0.5;

      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * velocityMultiplier,
          vy: (Math.random() - 0.5) * velocityMultiplier,
          size: minSize + Math.random() * (maxSize - minSize),
          opacity: 0.1 + Math.random() * 0.9,
          opacityVel: (Math.random() - 0.5) * 0.04
        });
      }
    }

    function resize() {
      var dpr = window.devicePixelRatio || 1;
      var width = container.clientWidth || window.innerWidth;
      var height = container.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles(width, height);
    }

    var mappedSpeed = mapFlickerUiToInternal(speed);
    var driftMag = movement * 0.1;
    var driftDir = angleToDrift(angle);
    var driftVx = driftDir.vx * driftMag;
    var driftVy = driftDir.vy * driftMag;

    var bgRgba = parseColorToRgba(bgHex);
    var bgColor = rgbaToCanvasColor(bgRgba);
    var pRgba = parseColorToRgba(particleColorHex);
    var pColorBase = rgbaToCanvasColor({ r: pRgba.r, g: pRgba.g, b: pRgba.b, a: 1 });

    function draw() {
      var dpr = window.devicePixelRatio || 1;
      var width = canvas.width / dpr;
      var height = canvas.height / dpr;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = pColorBase;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx + driftVx;
        p.y += p.vy + driftVy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        p.opacity += p.opacityVel * mappedSpeed * 0.5;
        if (p.opacity <= 0.1 || p.opacity >= 1) {
          p.opacityVel *= -1;
        }
        p.opacity = Math.max(0.1, Math.min(1, p.opacity));

        ctx.globalAlpha = pRgba.a * p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      animationId = requestAnimationFrame(draw);
    }

    resize();
    draw();

    window.addEventListener('resize', resize);

    return {
      destroy: function() {
        if (animationId) cancelAnimationFrame(animationId);
        window.removeEventListener('resize', resize);
      },
      resize: resize
    };
  }

  window.initStardustBackground = initStardustBackground;
})(window);
