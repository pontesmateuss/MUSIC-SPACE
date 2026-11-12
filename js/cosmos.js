/* ==========================================================
   Music Space — cosmos.js
   1) fundo global: estrelas e nebulosa que reagem à velocidade do scroll
   2) galáxia do hero: espiral que se forma na abertura e reage ao som
   3) túnel de estrelas do bloco final
   ========================================================== */
(function () {
  'use strict';
  const MS = window.MS;
  const U = MS.util;
  const TAU = U.TAU;

  /* ======================================================
     1) FUNDO GLOBAL
     ====================================================== */
  const Cosmos = (function () {
    const cv = U.$('#cosmos');
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, stars = [];
    let lastY = window.scrollY, vel = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const TINTS = ['236,230,255', '255,214,170', '170,214,255', '210,190,255'];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const n = Math.round(U.clamp(W * H / 6500, 110, 280));
      stars = [];
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H, d: U.rand(0.15, 1),
          s: U.rand(0.5, 1.6), p: Math.random() * TAU, sp: U.rand(0.0007, 0.0024),
          c: TINTS[(Math.random() * TINTS.length) | 0],
        });
      }
      if (U.reduce) draw(0);
    }

    function draw(t) {
      const y = window.scrollY;
      vel += ((y - lastY) - vel) * 0.16;
      lastY = y;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      /* nebulosa em três camadas (parallax lento com o scroll) */
      const neb = [
        [W * 0.82 + mouse.x * -18, H * 0.18 - y * 0.05, W * 0.62, 'rgba(112,82,232,.17)'],
        [W * 0.08 + mouse.x * -10, H * 0.78 - y * 0.03, W * 0.56, 'rgba(214,92,196,.075)'],
        [W * 0.5, H * 0.5 - y * 0.015, W * 0.85, 'rgba(40,64,168,.085)'],
      ];
      for (const n of neb) {
        const g = ctx.createRadialGradient(n[0], n[1], 0, n[0], n[1], n[2]);
        g.addColorStop(0, n[3]); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }

      /* estrelas: ficam pontos parados e viram riscos quando o scroll acelera */
      const streakK = U.clamp(Math.abs(vel), 0, 90);
      for (const s of stars) {
        const py = (((s.y - y * 0.14 * s.d) % H) + H) % H;
        const px = s.x - mouse.x * 12 * s.d;
        const tw = 0.55 + 0.45 * Math.sin(s.p + t * s.sp);
        const a = tw * (0.28 + 0.72 * s.d);
        const len = U.clamp(vel * s.d * 2.4, -150, 150);
        if (Math.abs(len) > 1.6) {
          const g = ctx.createLinearGradient(px, py, px, py + len);
          g.addColorStop(0, `rgba(${s.c},${Math.min(1, a + 0.25)})`);
          g.addColorStop(1, `rgba(${s.c},0)`);
          ctx.strokeStyle = g; ctx.lineWidth = s.s;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + len); ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${s.c},${a})`;
          ctx.fillRect(px, py, s.s, s.s);
        }
      }
    }

    function loop(t) {
      if (!document.hidden) draw(t);
      requestAnimationFrame(loop);
    }

    window.addEventListener('pointermove', (e) => {
      mouse.tx = (e.clientX / W - 0.5) * 2; mouse.ty = (e.clientY / H - 0.5) * 2;
    }, { passive: true });
    window.addEventListener('resize', resize);
    resize();
    if (!U.reduce) requestAnimationFrame(loop);
  })();

  /* ======================================================
     2) GALÁXIA DO HERO
     ====================================================== */
  const Galaxy = (function () {
    const hero = U.$('#hero');
    const cv = U.$('#galaxy');
    const ctx = cv.getContext('2d');
    const anchor = U.$('#anchor');
    const planet = U.$('#heroPlanet');
    const moonB = U.$('#moonBack');
    const moonF = U.$('#moonFront');

    const COLORS = ['255,238,210', '236,214,255', '196,170,255', '150,160,255', '255,150,225'];
    const ALPHAS = [0.32, 0.58, 0.92];

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 0;
    let buckets = [];
    let rot = 0, boost = 1, boostTarget = 1, warpUntil = 0, moonA = Math.PI + 0.25;
    let born = 0, running = false, last = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    function build() {
      buckets = [];
      for (let k = 0; k < COLORS.length; k++)
        for (let a = 0; a < ALPHAS.length; a++)
          buckets.push({ fill: `rgba(${COLORS[k]},${ALPHAS[a]})`, d: [] });

      const N = Math.round(U.clamp(W * H / 60, 4500, 13000));
      const arms = 4;
      for (let i = 0; i < N; i++) {
        let r, th, k, s;
        if (Math.random() < 0.26) {                 // bulbo
          r = Math.pow(Math.random(), 2.4) * 0.26;
          th = Math.random() * TAU;
          k = Math.random() < 0.7 ? 0 : 1;
          s = U.rand(0.6, 1.5);
        } else {                                    // braços
          r = Math.pow(Math.random(), 1.45) * 0.97 + 0.03;
          const arm = (Math.random() * arms) | 0;
          th = arm * TAU / arms + r * 7.2 + U.gauss() * (0.22 + 0.55 * r);
          k = r < 0.25 ? (Math.random() < 0.5 ? 0 : 1) : r < 0.55 ? (Math.random() < 0.5 ? 1 : 2) : (Math.random() < 0.5 ? 2 : 3);
          if (r > 0.35 && Math.random() < 0.16) k = 4;
          s = U.rand(0.55, 1.7) * (1.15 - r * 0.4);
        }
        const z = U.gauss() * 0.05 * (1 - r * 0.6);
        let a = Math.random() < 0.55 ? 0 : (Math.random() < 0.65 ? 1 : 2);
        if (r < 0.3 && a < 2 && Math.random() < 0.6) a++;
        buckets[k * ALPHAS.length + a].d.push(r, th, z, s);
      }
    }

    function resize() {
      const hr = hero.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hr.width; H = hr.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const ar = anchor.getBoundingClientRect();
      cx = ar.left - hr.left + ar.width / 2;
      cy = ar.top - hr.top + ar.height / 2;
      R = W < 980 ? W * 0.72 : Math.min(H * 1.02, W * 0.37);
      build();
      if (U.reduce) { born = -1e9; draw(performance.now(), 0); }
    }

    function draw(t, dt) {
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      boost += (boostTarget - boost) * 0.06;

      const bass = MS.audio.level.bass, lvl = MS.audio.level.v;
      const speed = boost + (t < warpUntil ? 6 : 0) + bass * 3.2;
      rot += dt * 0.00011 * speed;

      /* abertura: a espiral se forma, de enrolada para aberta */
      const k = U.clamp((t - born) / 3000, 0, 1);
      const intro = U.easeOut(k);
      const twist = 7.2 * (1 + (1 - intro) * 1.5);
      const Re = R * (0.5 + 0.5 * intro) * (1 + bass * 0.05);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);

      const tilt = 0.40 + mouse.y * 0.05;
      const ang = -0.38 + mouse.x * 0.06;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const gx = cx + mouse.x * 12, gy = cy + mouse.y * 8;

      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = intro;
      ctx.save();
      ctx.translate(gx, gy); ctx.rotate(ang); ctx.scale(1, tilt * 1.15);
      let g = ctx.createRadialGradient(0, 0, 0, 0, 0, Re);
      g.addColorStop(0, 'rgba(190,160,255,.30)');
      g.addColorStop(0.35, 'rgba(120,90,230,.14)');
      g.addColorStop(1, 'rgba(60,40,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, Re, 0, TAU); ctx.fill();
      const core = Re * (0.28 + bass * 0.12);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, core);
      g.addColorStop(0, `rgba(255,236,205,${0.55 + bass * 0.35})`);
      g.addColorStop(1, 'rgba(255,200,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, core, 0, TAU); ctx.fill();
      ctx.restore();

      const sz = 1 + lvl * 0.7;
      for (const b of buckets) {
        ctx.fillStyle = b.fill;
        const d = b.d;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const th = d[i + 1] + (twist - 7.2) * r + rot * (1.7 - r * 1.35);
          const z = d[i + 2], s = d[i + 3] * sz;
          const rr = r * Re, x = Math.cos(th) * rr, y = Math.sin(th) * rr;
          ctx.fillRect(gx + x * ca - y * tilt * sa, gy + x * sa + y * tilt * ca - z * Re * 0.6, s, s);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      /* brilho e escala do planeta seguem o som */
      planet.style.setProperty('--lvl', Math.min(1, bass * 1.4).toFixed(3));

      /* lua orbitando o anel */
      moonA += dt * 0.00055 * Math.min(speed, 3);
      const mx = 210 + 200 * Math.cos(moonA), my = 210 + 74 * Math.sin(moonA);
      const front = Math.sin(moonA) > 0;
      const on = front ? moonF : moonB, off = front ? moonB : moonF;
      on.style.opacity = 1; off.style.opacity = 0;
      on.style.left = (mx / 420 * 100) + '%';
      on.style.top = (my / 420 * 100) + '%';
    }

    function loop(t) {
      if (!running) return;
      const dt = Math.min(50, t - last || 16); last = t;
      draw(t, dt);
      requestAnimationFrame(loop);
    }
    function start() { if (running || U.reduce) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
    function stop() { running = false; }

    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    hero.addEventListener('pointerleave', () => { mouse.tx = 0; mouse.ty = 0; });
    planet.addEventListener('pointerenter', () => { boostTarget = 2.4; });
    planet.addEventListener('pointerleave', () => { boostTarget = 1; });
    planet.addEventListener('focus', () => { boostTarget = 2.4; });
    planet.addEventListener('blur', () => { boostTarget = 1; });
    planet.addEventListener('click', () => { warpUntil = performance.now() + 1100; });

    born = performance.now() + 150;
    new ResizeObserver(resize).observe(hero);
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(hero);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    resize();
    if (U.reduce) { moonB.style.opacity = 1; moonB.style.left = '2.5%'; moonB.style.top = '40%'; }
  })();

  /* ======================================================
     3) TÚNEL DE ESTRELAS (bloco final)
     ====================================================== */
  const Warp = (function () {
    const cv = U.$('#warp');
    const sec = cv.parentElement;
    const btn = U.$('#finalBtn');
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, stars = [], running = false, last = 0;
    let speed = 0.16, speedTarget = 0.16;

    function reset(s, initial) {
      s.x = U.rand(-1, 1); s.y = U.rand(-1, 1);
      s.z = initial ? U.rand(0.05, 1) : 1;
      s.c = Math.random() < 0.25 ? '255,200,150' : '210,196,255';
    }
    function resize() {
      const r = sec.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      stars = Array.from({ length: U.clamp(Math.round(W / 4), 120, 380) }, () => { const s = {}; reset(s, true); return s; });
      if (U.reduce) draw(0);
    }
    function draw(dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      speed += (speedTarget - speed) * 0.05;
      const cx = W / 2, cy = H / 2, sc = Math.max(W, H) * 0.55;
      for (const s of stars) {
        const z0 = s.z;
        s.z -= speed * dt * 0.001;
        if (s.z <= 0.02) { reset(s, false); continue; }
        const x0 = cx + s.x / z0 * sc * 0.18, y0 = cy + s.y / z0 * sc * 0.18;
        const x1 = cx + s.x / s.z * sc * 0.18, y1 = cy + s.y / s.z * sc * 0.18;
        if (x1 < -50 || x1 > W + 50 || y1 < -50 || y1 > H + 50) { reset(s, false); continue; }
        const a = U.clamp((1 - s.z) * 1.3, 0, 1);
        ctx.strokeStyle = `rgba(${s.c},${a})`;
        ctx.lineWidth = 0.6 + (1 - s.z) * 1.6;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
    function loop(t) {
      if (!running) return;
      const dt = Math.min(50, t - last || 16); last = t;
      draw(dt);
      requestAnimationFrame(loop);
    }
    function start() { if (running || U.reduce) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
    function stop() { running = false; }

    btn.addEventListener('pointerenter', () => { speedTarget = 1.5; });
    btn.addEventListener('pointerleave', () => { speedTarget = 0.16; });
    btn.addEventListener('focus', () => { speedTarget = 1.5; });
    btn.addEventListener('blur', () => { speedTarget = 0.16; });
    new ResizeObserver(resize).observe(sec);
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(sec);
    resize();
  })();
})();
