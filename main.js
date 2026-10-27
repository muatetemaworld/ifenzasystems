/* =========================================================
   IFENZA · main.js
   1. Campo «Convergencia» (canvas, semilla 7 = la de la marca)
   2. Hero ligado al scroll (GSAP ScrollTrigger con scrub; fallback rAF)
   3. Entradas de sección, pasos del método, divisor estático
   Solo se animan transform, opacity y stroke-dashoffset.
   ========================================================= */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobileMQ = window.matchMedia('(max-width: 767px)');
  var darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  /* M30 · Versión oscura de Convergencia: hueso (lino) → cobre sobre tinta */
  var fieldColors = function () {
    return darkMQ.matches ? { hueso: [120, 108, 98], cobre: [169, 77, 52] } : { hueso: [217, 207, 192], cobre: [169, 77, 52] };
  };
  var smooth = function (a, b, x) { var t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ---------- Generador determinista (mulberry32) ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Campo Convergencia ----------
     Cada línea tiene una base horizontal y un desplazamiento turbulento.
     o(x, q) ∈ [0,1] es cuánto está ordenada la línea en x: 0 = turbulencia, 1 = carril.
     El frente de orden avanza de derecha a izquierda con q. */
  function Field(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.count = opts.count;
    this.setColors();
    this.alpha = opts.alpha || 0.9;
    this.lastQ = -1;
    this.resize();
  }

  Field.prototype.setColors = function () {
    var c = fieldColors();
    this.hueso = c.hueso;   // Arena #D9CFC0 en claro
    this.cobre = c.cobre;   // Terracota #A94D34
    this.lastQ = -1;
  };

  Field.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    if (!W || !H) return;
    this.W = W; this.H = H;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var r = rng(7), N = this.count, lines = [];
    var TAU = Math.PI * 2;
    for (var i = 0; i < N; i++) {
      var t = N > 1 ? i / (N - 1) : 0.5;
      lines.push({
        base: H * (0.04 + 0.92 * t),
        drift: (r() - 0.5) * H * 0.9,
        a0: H * 0.07, k0: (1.1 + 0.4 * r()) * TAU / W, p0: t * 2.2,
        a1: H * (0.05 + 0.09 * r()), k1: (1.5 + 2.5 * r()) * TAU / W, p1: r() * TAU,
        a2: H * (0.02 + 0.05 * r()), k2: (4 + 5 * r()) * TAU / W, p2: r() * TAU,
        a3: H * 0.015 * r(), k3: (10 + 8 * r()) * TAU / W, p3: r() * TAU,
        w: 0.8 + 0.6 * r()
      });
    }
    this.lines = lines;
    this.lastQ = -1;
  };

  Field.prototype.order = function (xn, q) {
    var f = 1.05 - 1.5 * q;               // posición del frente (1 = borde derecho)
    return smooth(f - 0.5, f + 0.1, xn);
  };

  Field.prototype.draw = function (q) {
    if (!this.lines) return;
    if (Math.abs(q - this.lastQ) < 0.002) return;
    this.lastQ = q;
    var ctx = this.ctx, W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);

    // Un degradado por fotograma: el color se gana al ordenarse (hueso → cobre)
    var grad = ctx.createLinearGradient(0, 0, W, 0);
    for (var s = 0; s <= 12; s++) {
      var xn = s / 12, o = this.order(xn, q);
      var c = [Math.round(lerp(this.hueso[0], this.cobre[0], o)), Math.round(lerp(this.hueso[1], this.cobre[1], o)), Math.round(lerp(this.hueso[2], this.cobre[2], o))];
      grad.addColorStop(xn, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + this.alpha + ')');
    }
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var step = W > 900 ? 6 : 8;
    for (var i = 0; i < this.lines.length; i++) {
      var L = this.lines[i];
      ctx.lineWidth = L.w;
      ctx.beginPath();
      for (var x = 0; x <= W + step; x += step) {
        var xn2 = x / W;
        var o2 = this.order(xn2, q);
        var d = (xn2 - 0.5) * L.drift
              + L.a0 * Math.sin(x * L.k0 + L.p0)
              + L.a1 * Math.sin(x * L.k1 + L.p1)
              + L.a2 * Math.sin(x * L.k2 + L.p2)
              + L.a3 * Math.sin(x * L.k3 + L.p3);
        var y = L.base + (1 - o2) * d;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  };

  /* ---------- Hero ---------- */
  var hero = document.querySelector('[data-hero]');
  if (hero) {
    var canvas = hero.querySelector('.hero-field');
    var act1 = hero.querySelector('[data-act1]');
    var persona = hero.querySelector('[data-persona]');
    var act3 = hero.querySelector('[data-act3]');
    var photo = hero.querySelector('[data-photo]');
    var underline = hero.querySelector('[data-underline]');
    var labels = Array.prototype.slice.call(hero.querySelectorAll('.hero-label'));
    var pista = hero.querySelector('[data-pista]');

    /* ---------- Vídeo del hero ligado al scroll ----------
       Se activa solo en escritorio, sin reduced-motion y cuando el vídeo tiene datos suficientes.
       El scroll fija video.currentTime (sin autoplay). Si no carga, se queda el canvas. */
    var video = hero.querySelector('[data-hero-video]');
    var videoOn = false, videoDur = 0, videoSeeking = false, videoNext = -1;
    if (video && !reduce && !mobileMQ.matches) {
      var activar = function () {
        if (videoOn || !video.duration) return;
        videoDur = video.duration; videoOn = true;
        hero.classList.add('has-video');
        try { video.pause(); } catch (e) {}
        video.currentTime = 0;
      };
      video.addEventListener('loadedmetadata', function () { video.load && video.preload !== 'auto' && (video.preload = 'auto'); });
      video.addEventListener('canplaythrough', activar);
      video.addEventListener('seeked', function () { videoSeeking = false; if (videoNext >= 0) { var t = videoNext; videoNext = -1; seekVideo(t); } });
      video.addEventListener('error', function () { videoOn = false; hero.classList.remove('has-video'); });
      if (video.readyState >= 4) activar();
    }
    function seekVideo(t) {
      if (!videoOn) return;
      if (videoSeeking) { videoNext = t; return; }
      videoSeeking = true;
      try { video.currentTime = t; } catch (e) { videoSeeking = false; }
    }
    var field = new Field(canvas, { count: mobileMQ.matches ? 40 : 84 });
    var staticMode = reduce;

    function applyProgress(p) {
      // Acto 1 (0–33 %): el trazo ámbar se dibuja con el primer 10 % de scroll
      if (underline) underline.style.strokeDashoffset = String(1 - clamp(p / 0.10));

      // Acto 2 (33–66 %): el campo se ordena de izquierda a derecha
      var q = clamp((p - 0.33) / 0.33);

      // Etiquetas: entran una a una (fundido de 150 ms por CSS), salen en el acto 3
      var umbrales = [0.30, 0.55, 0.80];
      for (var i = 0; i < labels.length; i++) {
        labels[i].classList.toggle('is-on', q > umbrales[i] && p < 0.72);
      }

      // Acto 3 (66–100 %): campo al 60 %, cambio de titular, foto y botones
      var atenua = 1 - 0.4 * clamp((p - 0.66) / 0.14);
      canvas.style.opacity = String(atenua);
      if (!videoOn) field.draw(q); else canvas.style.display = 'none';
      if (videoOn) {
        // El vídeo recorre toda su duración a lo largo del hero y se atenúa en el acto 3 igual que el campo
        seekVideo(Math.min(videoDur - 0.05, p * videoDur));
        video.style.opacity = String(0.13 * atenua);
      }

      // M24 · La pista de scroll desaparece con el primer 5 %
      if (pista) pista.style.opacity = String(1 - clamp(p / 0.05));

      var out = clamp((p - 0.60) / 0.10);
      act1.style.opacity = String(1 - out);
      act1.style.transform = 'translateY(' + (-16 * out) + 'px)';
      act1.style.pointerEvents = out > 0.5 ? 'none' : '';
      act1.style.visibility = out >= 1 ? 'hidden' : '';          // M16 · fuera del orden de tabulación y del lector
      if (persona) { persona.style.opacity = String(1 - clamp(out * 1.6)); persona.style.transform = 'translateY(' + (24 * out) + 'px)'; }

      var inn = clamp((p - 0.70) / 0.14);
      act3.style.opacity = String(inn);
      act3.style.transform = 'translateY(' + (16 * (1 - inn)) + 'px)';
      act3.style.pointerEvents = inn > 0.5 ? 'auto' : 'none';
      act3.style.visibility = inn <= 0 ? 'hidden' : '';           // M16

      var ph = clamp((p - 0.72) / 0.18);
      photo.style.opacity = String(ph);
      photo.style.visibility = ph <= 0 ? 'hidden' : '';
      photo.style.transform = mobileMQ.matches
        ? 'translateY(' + (24 * (1 - ph)) + 'px)'
        : 'translateX(' + (40 * (1 - ph)) + 'px)';
    }

    if (staticMode) {
      // Movimiento reducido: estado del acto 3, sin animación, todo visible
      field.draw(1);
      window.addEventListener('resize', function () { field.resize(); field.draw(1); });
    } else {
      hero.classList.remove('is-static');

      var lastP = 0;
      // M03 · Resize con retardo y solo si cambia el ancho (la barra del navegador móvil cambia el alto sin parar)
      var lastW = window.innerWidth, resizeTimer = 0;
      var onResize = function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          if (window.innerWidth === lastW && mobileMQ.matches) return;
          lastW = window.innerWidth;
          field.resize();
          field.draw(clamp((lastP - 0.33) / 0.33));
          if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        }, 150);
      };
      window.addEventListener('resize', onResize);
      if (darkMQ.addEventListener) darkMQ.addEventListener('change', function () { field.setColors(); field.draw(clamp((lastP - 0.33) / 0.33)); });

      // M02 · Fuera de pantalla no se redibuja nada
      var heroVisible = true;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; }, { threshold: 0 }).observe(hero);
      }
      var run = function (p) { lastP = p; if (heroVisible) applyProgress(p); };

      var startGsap = function () {
        window.gsap.registerPlugin(window.ScrollTrigger);
        var state = { p: 0 };
        window.gsap.to(state, {
          p: 1,
          ease: 'none',
          onUpdate: function () { run(state.p); },
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 0.5 }
        });
        run(0);
      };

      // M01 · GSAP solo en escritorio y cargado tras el primer pintado; móvil usa el fallback (más ligero)
      var loadScript = function (src) {
        return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      };
      var useGsap = !mobileMQ.matches;
      var gsapReady = false;
      if (useGsap) {
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js')
          .then(function () { return loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js'); })
          .then(function () { if (window.gsap && window.ScrollTrigger) { gsapReady = true; window.removeEventListener('scroll', measure); startGsap(); } })
          .catch(function () { /* se queda el fallback */ });
      }
      // Fallback sin GSAP (y arranque mientras GSAP carga): progreso por scroll suavizado con rAF
      var target = 0, current = 0, ticking = false;
      var measure = function () {
        if (gsapReady) return;
        var rect = hero.getBoundingClientRect();
        var total = rect.height - window.innerHeight;
        target = total > 0 ? clamp(-rect.top / total) : 1;
        if (!ticking) { ticking = true; window.requestAnimationFrame(tick); }
      };
      var tick = function () {
        if (gsapReady) { ticking = false; return; }
        current += (target - current) * 0.18;
        if (Math.abs(target - current) < 0.0005) { current = target; ticking = false; } else { window.requestAnimationFrame(tick); }
        run(current);
      };
      window.addEventListener('scroll', measure, { passive: true });
      measure();

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); });
      }
    }
  }

  /* ---------- Divisor Convergencia (estático) ---------- */
  var divisor = document.querySelector('[data-divisor]');
  if (divisor) {
    var div = new Field(divisor, { count: 26, alpha: 0.85 });
    var drawDiv = function () { div.resize(); div.lastQ = -1; div.draw(0.35); };
    drawDiv();
    window.addEventListener('resize', drawDiv);
  }

  /* ---------- Entradas de sección (una sola vez) ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  }

  /* ---------- M27 · Eventos de analítica sin cookies ----------
     No se carga ningún script de terceros. Los clics con data-evento se empujan a window.dataLayer
     (listo para Plausible, Umami, GA4 o Matomo cuando Hermes decida; mientras, sin aviso de cookies). */
  window.dataLayer = window.dataLayer || [];
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-evento]');
    if (!el) return;
    window.dataLayer.push({ event: el.getAttribute('data-evento'), dolor: el.getAttribute('data-dolor') || document.body.getAttribute('data-dolor') || '', href: el.getAttribute('href') || '' });
    if (typeof window.plausible === 'function') window.plausible(el.getAttribute('data-evento'));
  });

  /* ---------- M21 · Las UTM de la visita viajan al calendario y al correo ---------- */
  var utm = {};
  try {
    new URLSearchParams(location.search).forEach(function (v, k) { if (/^utm_/.test(k)) utm[k] = v; });
    if (Object.keys(utm).length) sessionStorage.setItem('ifenza_utm', JSON.stringify(utm));
    else utm = JSON.parse(sessionStorage.getItem('ifenza_utm') || '{}');
  } catch (e) { utm = {}; }
  var calendario = document.querySelector('[data-calendario]');
  if (calendario && Object.keys(utm).length) {
    try {
      var u = new URL(calendario.href);
      Object.keys(utm).forEach(function (k) { u.searchParams.set(k, utm[k]); });
      calendario.href = u.toString();
    } catch (e) {}
  }

  /* ---------- M19 · El dolor elegido se prellena en WhatsApp, calendario y correo ---------- */
  var minus = function (s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; };
  var whatsapp = document.querySelector('[data-whatsapp]');
  var correo = document.querySelector('[data-correo]');
  var waBase = whatsapp ? whatsapp.href.split('?')[0] : '';
  var mailBase = correo ? correo.href.split('?')[0] : '';
  Array.prototype.forEach.call(document.querySelectorAll('.dolor'), function (a) {
    a.addEventListener('click', function () {
      var texto = a.getAttribute('data-dolor') || '';
      document.body.setAttribute('data-dolor', texto);
      Array.prototype.forEach.call(document.querySelectorAll('.dolor'), function (o) { o.classList.toggle('is-elegido', o === a); });
      if (whatsapp) whatsapp.href = waBase + '?text=' + encodeURIComponent('Hola Hermes, quiero un Diagnóstico IA. Lo que más tiempo me quita: ' + minus(texto));
      if (correo) correo.href = mailBase + '?subject=' + encodeURIComponent('Diagnóstico IA') + '&body=' + encodeURIComponent('Hola Hermes, lo que más tiempo me quita: ' + minus(texto) + '\n\n');
      if (calendario) { try { var u2 = new URL(calendario.href); u2.searchParams.set('dolor', texto); calendario.href = u2.toString(); } catch (e) {} }
    });
  });

  /* ---------- M18 · Barra fija: visible tras el hero, oculta en el cierre ---------- */
  var barra = document.querySelector('[data-barra]');
  var cierre = document.getElementById('siguiente-paso');
  if (barra && hero && 'IntersectionObserver' in window) {
    var heroPasado = false, cierreVisible = false;
    var pintaBarra = function () {
      var mostrar = heroPasado && !cierreVisible;
      if (mostrar) barra.hidden = false;
      barra.classList.toggle('is-visible', mostrar);
    };
    new IntersectionObserver(function (e) { heroPasado = !e[0].isIntersecting && e[0].boundingClientRect.bottom < 0; pintaBarra(); }, { threshold: 0 }).observe(hero);
    if (cierre) new IntersectionObserver(function (e) { cierreVisible = e[0].isIntersecting; pintaBarra(); }, { threshold: 0.2 }).observe(cierre);
  }

  /* ---------- M14 · Pausa accesible del marquee ---------- */
  var marquee = document.querySelector('.marquee');
  var pausa = document.querySelector('[data-marquee-pausa]');
  if (marquee && pausa) {
    if (reduce) { marquee.classList.add('is-paused'); pausa.hidden = true; }
    pausa.addEventListener('click', function () {
      var on = marquee.classList.toggle('is-paused');
      pausa.setAttribute('aria-pressed', String(on));
      pausa.setAttribute('aria-label', on ? 'Reanudar el movimiento de los sectores' : 'Pausar el movimiento de los sectores');
      pausa.innerHTML = on
        ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';
    });
  }

  /* ---------- Pasos del método: se iluminan al hacer scroll ---------- */
  var pasos = document.querySelectorAll('[data-pasos] .paso-item');
  if (pasos.length) {
    if (reduce || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(pasos, function (el) { el.classList.add('is-lit'); });
    } else {
      var ioPasos = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-lit'); ioPasos.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -35% 0px', threshold: 0.5 });
      Array.prototype.forEach.call(pasos, function (el) { ioPasos.observe(el); });
    }
  }
})();

/* =========================================================
   v6 · calculadora (N11), test de 5 preguntas (N10), formulario de contacto (N02), prellenado por URL
   ========================================================= */
(function () {
  'use strict';
  var fmt = function (n) { return Math.round(n).toLocaleString('es-ES'); };

  /* N11 · Calculadora: coste anual de la tarea hecha a mano (46 semanas laborables) */
  var calc = document.querySelector('[data-calculadora]');
  if (calc) {
    var inputs = calc.querySelectorAll('input');
    var total = calc.querySelector('[data-calc-total]');
    var det = calc.querySelector('[data-calc-detalle]');
    var recalc = function () {
      var h = parseFloat(calc.querySelector('[name=horas]').value) || 0;
      var p = parseFloat(calc.querySelector('[name=personas]').value) || 1;
      var c = parseFloat(calc.querySelector('[name=coste]').value) || 0;
      var horasAno = h * p * 46;
      total.textContent = fmt(horasAno * c);
      det.textContent = fmt(horasAno) + ' horas al año' + (p > 1 ? ' entre ' + p + ' personas' : '');
    };
    Array.prototype.forEach.call(inputs, function (i) { i.addEventListener('input', recalc); });
    recalc();
  }

  /* N10 · Test: cinco preguntas → pack sugerido → contacto prellenado */
  var test = document.querySelector('[data-test]');
  if (test) {
    var res = test.querySelector('[data-test-resultado]');
    test.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = {};
      ['sector', 'tamano', 'tarea', 'horas', 'herr'].forEach(function (n) { var el = test.querySelector('[name=' + n + ']:checked'); v[n] = el ? el.value : ''; });
      if (!v.sector || !v.tamano || !v.tarea || !v.horas || !v.herr) { res.hidden = false; res.innerHTML = '<p>Falta alguna respuesta. Las cinco cuentan.</p>'; return; }
      var pack, texto;
      if (v.tarea === 'No lo sé' || v.horas === 'Menos de 3') {
        pack = 'Diagnóstico IA'; texto = 'Todavía no hay una tarea clara o se va poco tiempo en ella. Lo mejor es medir una semana y hablarlo en 20 minutos: te digo si hay algo que compense o si conviene esperar.';
      } else if (v.horas === 'Más de 20' || v.tamano === '21 a 50' || v.tamano === 'Más de 50' || v.herr === 'Un poco de todo') {
        pack = 'Sistema'; texto = 'Hay varias tareas que se pasan el trabajo entre sí o mucha gente implicada. Encaja un sistema de 6 a 10 semanas, empezando por la tarea que más horas se lleva.';
      } else {
        pack = 'Una tarea'; texto = 'Una tarea clara, repetida y con horas detrás. Es el caso ideal para empezar: 4 a 6 semanas y una tarea en producción.';
      }
      var papel = v.herr === 'Papel' ? ' Como hoy está en papel, el primer paso será ponerlo por escrito en un sitio: lo hacemos juntos la primera semana.' : '';
      var url = 'contacto.html?sector=' + encodeURIComponent(v.sector) + '&tamano=' + encodeURIComponent(v.tamano) + '&dolor=' + encodeURIComponent(v.tarea + ' · ' + v.horas + ' horas/semana · ' + v.herr) + '&pack=' + encodeURIComponent(pack);
      res.hidden = false;
      res.innerHTML = '<span class="etiqueta">Por dónde empezar</span><h3>' + pack + '</h3><p>' + texto + papel + '</p><a class="btn btn-lino" href="' + url + '" data-evento="test_contacto">Cuéntamelo con estos datos</a>';
      res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'test_resultado', pack: pack, sector: v.sector });
    });
  }

  /* N02 · Formulario de contacto: prellenado desde la URL y envío por correo mientras no haya backend */
  var form = document.querySelector('[data-form-contacto]');
  if (form) {
    try {
      var q = new URLSearchParams(location.search);
      var map = { sector: 'sector', dolor: 'dolor', nombre: 'nombre', empresa: 'empresa' };
      Object.keys(map).forEach(function (k) {
        var val = q.get(k); if (!val) return;
        var el = form.querySelector('[name=' + map[k] + ']'); if (!el) return;
        if (el.tagName === 'SELECT') { Array.prototype.forEach.call(el.options, function (o) { if (o.text.toLowerCase().indexOf(val.toLowerCase().split(' ')[0]) === 0) el.value = o.text; }); }
        else el.value = val;
      });
      var extra = [];
      if (q.get('pack')) extra.push('Pack sugerido: ' + q.get('pack'));
      if (q.get('tamano')) extra.push('Tamaño: ' + q.get('tamano'));
      if (q.get('recurso')) extra.push('Quiero el recurso: ' + q.get('recurso'));
      if (q.get('origen') === 'grande') { form.querySelector('[name=sector]').value = 'Empresa grande (operaciones)'; }
      if (extra.length) { var d = form.querySelector('[name=dolor]'); d.value = (d.value ? d.value + '\n' : '') + extra.join(' · '); }
    } catch (e) {}
    form.addEventListener('submit', function (e) {
      if (!form.checkValidity()) { e.preventDefault(); form.reportValidity(); return; }
      if (form.action.indexOf('PLACEHOLDER') !== -1) {
        // Sin backend todavía: se abre el correo con todo prellenado
        e.preventDefault();
        var g = function (n) { return (form.querySelector('[name=' + n + ']') || {}).value || ''; };
        var cuerpo = 'Nombre: ' + g('nombre') + '\nEmpresa: ' + g('empresa') + '\nCorreo: ' + g('correo') + '\nWhatsApp: ' + g('whatsapp') + '\nSector: ' + g('sector') + '\n\nQué me quita tiempo:\n' + g('dolor');
        location.href = 'mailto:hola@ifenzasystems.com?subject=' + encodeURIComponent('Diagnóstico IA · ' + g('empresa')) + '&body=' + encodeURIComponent(cuerpo);
      }
    });
  }
})();

/* =========================================================
   v8 · AALIYAH ZEGNA · presentadora virtual en vídeo
   Un clip por sección en assets/aaliyah/<pagina>-<seccion>.mp4 (ver assets/aaliyah/LEEME.txt).
   Si el clip no existe se queda el poster y, con el sonido activado, se lee el texto con la voz del navegador.
   ========================================================= */
(function () {
  'use strict';
  var box = document.querySelector('[data-aaliyah]');
  var heroVid = document.querySelector('[data-aaliyah-hero]');
  var heroBtn = document.querySelector('[data-aaliyah-hero-sonido]');
  var pagina = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';

  /* Guion (subtítulo de cada clip). Clave = id de sección; 'inicio' = arranque de la página. */
  var guion = {
    index: [
      ['inicio', 'Hola, soy Aaliyah. Te enseño cómo IFENZA ordena lo que te quita tiempo. Baja un poco y lo ves.'],
      ['duele', 'Esto es lo que más tiempo se lleva en un negocio. Si alguna te suena, púlsala: me la llevo a la llamada.'],
      ['no-hace', 'Antes de seguir, lo que la IA no te va a resolver. Mejor saberlo ahora.'],
      ['webs', 'Esto ya está hecho: webs y marcas construidas por IFENZA. Pulsa cualquiera y la ves en directo.'],
      ['sistemas', 'Aquí no se instalan apps. Se montan sistemas que siguen funcionando cuando nadie mira.'],
      ['metodo', 'Cuatro pasos con semanas y con lo que te toca a ti. Nada de meses sin noticias.'],
      ['packs', 'Lo que cuesta, antes de llamar. Prueba la calculadora: te dice lo que te cuesta hoy esa tarea.'],
      ['casos', 'Los casos se publican con cifra medida o no se publican. Mientras, mira tu sector.'],
      ['preguntas', 'Las preguntas que me hacen siempre. Si la tuya no está, me la haces en la llamada.'],
      ['quien', 'Detrás de IFENZA hay una persona que coge el teléfono. Sin equipo que rota.'],
      ['siguiente-paso', 'Veinte minutos. Te llevas por escrito tres tareas y por cuál empezar. ¿Lo reservamos?']
    ],
    contacto: [
      ['inicio', 'Cuéntame qué te quita tiempo con tus palabras. Respondo en menos de un día laborable.'],
      ['reservar', 'Si prefieres hablar, elige un hueco. Veinte minutos, sin preparar nada.']
    ],
    trabajos: [
      ['inicio', 'Esto es lo que IFENZA ya ha construido: webs, marcas y los primeros sistemas de IA.'],
      ['casos', 'Cada caso de IA se publica con su cifra medida. Lo que no existe, no se publica.'],
      ['sectores', 'Busca tu sector: son las tareas que suelen quitar más tiempo en cada uno.']
    ],
    nosotros: [
      ['inicio', 'Aquí está quien coge el teléfono: Hermes, desde Valencia. Baja y ves de dónde viene.'],
      ['hermes', 'Eventos, marcas y marketing antes; sistemas de IA ahora. La misma manía: que las cosas funcionen solas.'],
      ['aaliyah', 'Esta soy yo. Virtual, sí, pero con nombre y con una forma de hablar que no cambia.'],
      ['equipo', 'Cuatro puestos clave con nombre y cara. Son perfiles creados con IA; las plazas se cubren con gente real.'],
      ['siguiente-paso', 'Si prefieres hablar con la persona y no con la web, reserva veinte minutos.']
    ],
    recursos: [
      ['inicio', 'Aquí hay cosas para llevarse sin registrarse. Empieza por la guía.'],
      ['test', 'Cinco preguntas y te digo por dónde empezaría yo. Las respuestas viajan al formulario.'],
      ['datos', 'Tus datos se quedan en tus cuentas. Cuatro líneas, sin letra pequeña.']
    ],
    'guia-que-automatizar-primero': [
      ['inicio', 'Diez minutos de lectura. Suma puntos y sabrás por qué tarea empezar.']
    ]
  };
  var pasos = guion[pagina] || guion.index;
  var idx = 0, sonido = false;

  var hablar = function (t) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(t); u.lang = 'es-ES'; u.rate = 0.98; u.pitch = 1.05;
    var voces = window.speechSynthesis.getVoices().filter(function (v) { return /^es/.test(v.lang); });
    var fem = voces.filter(function (v) { return /mónica|monica|lucia|lucía|paulina|elvira|helena|female|mujer/i.test(v.name); });
    if (fem[0] || voces[0]) u.voice = fem[0] || voces[0];
    window.speechSynthesis.speak(u);
  };

  /* Hero: vídeo de presentación. Arranca en silencio cuando el acto 3 es visible; «Escuchar» quita el silencio. */
  if (heroVid) {
    heroVid.addEventListener('error', function () { heroVid.removeAttribute('src'); }, true);
    var heroPlay = function () { var p = heroVid.play(); if (p && p.catch) p.catch(function () {}); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { if (e[0].isIntersecting && getComputedStyle(heroVid.parentNode).opacity !== '0') heroPlay(); else heroVid.pause(); }, { threshold: 0.4 }).observe(heroVid);
    }
    if (heroBtn) heroBtn.addEventListener('click', function () {
      var on = heroVid.muted; heroVid.muted = !on; heroVid.currentTime = 0; heroPlay();
      heroBtn.setAttribute('aria-pressed', String(on)); heroBtn.textContent = on ? 'Silenciar' : 'Escuchar';
      window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'aaliyah_hero_sonido', on: on });
    });
  }

  if (!box) return;
  var texto = box.querySelector('[data-aaliyah-texto]');
  var vid = box.querySelector('[data-aaliyah-video]');
  var btnSig = box.querySelector('[data-aaliyah-siguiente]');
  var btnVoz = box.querySelector('[data-aaliyah-voz]');
  var btnCerrar = box.querySelector('[data-aaliyah-cerrar]');
  var btnToggle = box.querySelector('[data-aaliyah-toggle]');
  var clipOk = false;

  var cargarClip = function (seccion) {
    clipOk = false;
    var raiz = (vid.getAttribute('poster') || '').indexOf('../') === 0 ? '../' : '';
    var base = raiz + 'assets/aaliyah/' + pagina + '-' + seccion;
    vid.innerHTML = '<source src="' + base + '.webm" type="video/webm"><source src="' + base + '.mp4" type="video/mp4">';
    vid.load();
    var p = vid.play(); if (p && p.catch) p.catch(function () {});
  };
  vid.addEventListener('loadeddata', function () { clipOk = true; });
  vid.addEventListener('error', function () { clipOk = false; vid.muted = true; }, true);
  vid.addEventListener('playing', function () { clipOk = true; if (sonido) { vid.muted = false; if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } });

  var di = function (i) {
    idx = Math.max(0, Math.min(pasos.length - 1, i));
    texto.textContent = pasos[idx][1];
    btnSig.textContent = idx === pasos.length - 1 ? 'Reservar' : 'Siguiente';
    cargarClip(pasos[idx][0]);
    // Si en medio segundo no hay clip, con el sonido activado se lee el subtítulo
    if (sonido) setTimeout(function () { if (!clipOk) hablar(pasos[idx][1]); }, 500);
  };

  var secciones = pasos.map(function (p) { return document.getElementById(p[0]); });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (!e.isIntersecting) return; var i = secciones.indexOf(e.target); if (i >= 0 && i !== idx) di(i); });
    }, { rootMargin: '-40% 0px -45% 0px', threshold: 0 });
    secciones.forEach(function (s) { if (s) io.observe(s); });
  }

  btnSig.addEventListener('click', function () {
    if (idx === pasos.length - 1) { location.href = pagina === 'index' ? '#siguiente-paso' : 'contacto.html#reservar'; return; }
    var dest = secciones[idx + 1];
    if (dest) dest.scrollIntoView({ behavior: 'smooth', block: 'start' }); else di(idx + 1);
    window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'aaliyah_siguiente', paso: pasos[idx][0] });
  });
  btnVoz.addEventListener('click', function () {
    sonido = !sonido;
    btnVoz.setAttribute('aria-pressed', String(sonido));
    btnVoz.setAttribute('aria-label', sonido ? 'Silenciar a Aaliyah' : 'Activar el sonido de Aaliyah');
    vid.muted = !sonido;
    if (sonido) { vid.currentTime = 0; var p = vid.play(); if (p && p.catch) p.catch(function () {}); setTimeout(function () { if (!clipOk) hablar(pasos[idx][1]); }, 300); }
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  });
  var plegar = function (p) { box.classList.toggle('is-plegada', p); btnToggle.setAttribute('aria-expanded', String(!p)); try { sessionStorage.setItem('aaliyah', p ? 'plegada' : 'abierta'); } catch (e) {} if (p && 'speechSynthesis' in window) window.speechSynthesis.cancel(); };
  btnCerrar.addEventListener('click', function () { plegar(true); });
  btnToggle.addEventListener('click', function () { plegar(!box.classList.contains('is-plegada')); });

  try { if (sessionStorage.getItem('aaliyah') === 'plegada') box.classList.add('is-plegada'); } catch (e) {}
  di(0);
  // En la portada, la acompañante aparece al salir del hero (ahí ya la presenta el vídeo grande)
  var heroEl = document.querySelector('[data-hero]');
  if (heroEl && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { box.hidden = e[0].isIntersecting; }, { threshold: 0 }).observe(heroEl);
  } else {
    setTimeout(function () { box.hidden = false; }, 1000);
  }
})();

/* v8.6 · Previsualización de trabajos: al pasar el ratón (o enfocar) se alternan tres fotogramas de la web, como un GIF */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  Array.prototype.forEach.call(document.querySelectorAll('.trabajo-captura[data-secuencia]'), function (fig) {
    var imgs = fig.querySelectorAll('img'); if (imgs.length < 2) return;
    var i = 0, timer = 0;
    var mostrar = function (n) { Array.prototype.forEach.call(imgs, function (im, k) { im.classList.toggle('is-activa', k === n); }); };
    var start = function () {
      if (reduce || timer) return;
      fig.classList.add('is-ciclando'); i = 0; mostrar(0);
      timer = setInterval(function () { i = (i + 1) % imgs.length; mostrar(i); }, 900);
    };
    var stop = function () { clearInterval(timer); timer = 0; fig.classList.remove('is-ciclando'); mostrar(0); };
    var a = fig.closest('a') || fig;
    a.addEventListener('mouseenter', start); a.addEventListener('mouseleave', stop);
    a.addEventListener('focus', start); a.addEventListener('blur', stop);
    // En pantallas táctiles: un toque largo no hay; se alterna con el scroll cuando la tarjeta está centrada
    if (window.matchMedia('(hover: none)').matches && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { e[0].isIntersecting ? start() : stop(); }, { rootMargin: '-35% 0px -35% 0px' }).observe(fig);
    }
  });
})();

/* v9.1 · Previa de trabajos en vídeo: se reproduce al pasar el ratón (o al centrarse en pantalla táctil) y vuelve al principio al salir */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  Array.prototype.forEach.call(document.querySelectorAll('[data-video-preview] video'), function (v) {
    var a = v.closest('a') || v;
    var play = function () { if (reduce) return; var p = v.play(); if (p && p.catch) p.catch(function () {}); };
    var stop = function () { v.pause(); try { v.currentTime = 0; } catch (e) {} };
    a.addEventListener('mouseenter', play); a.addEventListener('mouseleave', stop);
    a.addEventListener('focus', play); a.addEventListener('blur', stop);
    if (window.matchMedia('(hover: none)').matches && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { e[0].isIntersecting ? play() : stop(); }, { rootMargin: '-35% 0px -35% 0px' }).observe(v);
    }
  });
})();

/* v9.3 · Vídeos del blog: la portada carga el iframe de YouTube al pulsar */
(function () {
  document.querySelectorAll('.video-marco[data-yt]').forEach(function (m) {
    function play() {
      var id = m.getAttribute('data-yt'), t = m.getAttribute('data-titulo') || 'Vídeo';
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      f.title = t; f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true;
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      m.innerHTML = ''; m.appendChild(f); m.style.cursor = 'default';
    }
    m.addEventListener('click', play, { once: true });
  });
})();

/* v13 · Menú móvil: botón de tres rayas → panel a pantalla completa */
(function () {
  var menu = document.querySelector('[data-menu]');
  if (!menu) return;
  var botones = document.querySelectorAll('[data-menu-abrir]');
  var cerrarBtn = menu.querySelector('[data-menu-cerrar]');
  var ultimo = null;
  function abrir(origen) {
    ultimo = origen; menu.hidden = false;
    requestAnimationFrame(function () { menu.classList.add('is-abierto'); });
    document.body.classList.add('menu-abierto');
    Array.prototype.forEach.call(botones, function (b) { b.setAttribute('aria-expanded', 'true'); });
    if (cerrarBtn) cerrarBtn.focus();
  }
  function cerrar() {
    menu.classList.remove('is-abierto');
    document.body.classList.remove('menu-abierto');
    Array.prototype.forEach.call(botones, function (b) { b.setAttribute('aria-expanded', 'false'); });
    setTimeout(function () { menu.hidden = true; }, 200);
    if (ultimo && ultimo.focus) ultimo.focus();
  }
  Array.prototype.forEach.call(botones, function (b) { b.addEventListener('click', function () { abrir(b); }); });
  if (cerrarBtn) cerrarBtn.addEventListener('click', cerrar);
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) cerrar(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) cerrar(); });
  window.addEventListener('resize', function () { if (window.innerWidth > 1023 && !menu.hidden) cerrar(); });
})();
