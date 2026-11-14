/* ==========================================================
   Music Space — orbit.js
   mapa orbital: distribuição equilibrada entre órbitas, cada música é um planeta.
   hover, clique, teclado, cometa ao salvar, buraco negro ao remover.
   ========================================================== */
(function () {
  'use strict';
  const MS = window.MS;
  const U = MS.util;
  const TAU = U.TAU;

  const cv = U.$('#orbit');
  const ctx = cv.getContext('2d');
  const tip = U.$('#tip');
  const box = cv.parentElement;
  const FONT = '"Bricolage Grotesque","Segoe UI",system-ui,sans-serif';
  const SERIF = '"Instrument Serif",Georgia,serif';

  let W = 0, H = 0, dpr = 1;
  let songs = [], visible = null;
  let selected = null, hoverId = null, focusId = null;
  let inset = 0, insetCur = 0, tScale = 1;
  let t = 0, running = false, last = 0, queued = false, tipKey = '';
  let pos = [];
  let geo = { cx: 0, cy: 0, ratio: 0.5, maxRx: 200, rx: () => 100 };
  const spawn = new Map();     // id -> instante em que o planeta aparece
  const sinking = new Map();   // id -> { t0, dur, cb }
  const fx = [];               // cometas, flashes e buracos negros

  const isVis = (id) => !visible || visible.has(id);

  /* ---------- tamanho ---------- */
  function resize() {
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    invalidate();
  }

  /* ---------- posições ---------- */
  function build(now) {
    pos = [];
    const ratio = W < 760 ? 1.1 : 0.5;
    const availW = Math.max(220, W - insetCur);
    const cx = availW / 2, cy = H / 2 + 4;
    const maxRx = Math.min(availW * 0.46, (H * 0.44) / ratio);
    const k = U.clamp(maxRx / 380, 0.75, 1.25);
    geo = { cx, cy, ratio, maxRx, rx: (i) => maxRx * (0.3 + 0.7 * i / 4) };

    const groups = MS.libraryModel.distribute(songs, MS.MOODS.length);

    groups.forEach((g, i) => {
      const rx = geo.rx(i), ry = rx * ratio;
      const spd = 0.00011 * (1.7 - i * 0.3) * (i % 2 ? -1 : 1);
      g.forEach((s, j) => {
        const a = i * 1.1 + j * TAU / g.length + t * spd;
        const sn = Math.sin(a);
        let x = cx + Math.cos(a) * rx, y = cy + sn * ry;
        const D = (19 + Math.min(s.plays || 0, 40) / 40 * 13) * k;
        const depth = 0.84 + 0.2 * (sn + 1) / 2;
        let sc = 1, alpha = 1;

        const sp = spawn.get(s.id);
        if (sp != null) sc = now < sp ? 0 : U.easeOutBack(U.clamp((now - sp) / 700, 0, 1));

        const sk = sinking.get(s.id);
        if (sk) {
          const e = U.clamp((now - sk.t0) / sk.dur, 0, 1), kk = U.easeIn(e);
          const dx = x - cx, dy = y - cy, ang = kk * TAU * 1.4, f = 1 - kk;
          x = cx + (dx * Math.cos(ang) - dy * Math.sin(ang)) * f;
          y = cy + (dx * Math.sin(ang) + dy * Math.cos(ang)) * f;
          sc *= f;
        }
        pos.push({ s, x, y, r: D * depth / 2, sn, sc, alpha, mood: i });
      });
    });
  }

  /* ---------- desenho ---------- */
  function drawPlanet(p, now) {
    if (p.sc <= 0.02) return;
    const s = p.s, vis = isVis(s.id);
    const D = p.r * 2 * p.sc;
    const bass = MS.audio.level.bass;

    if (s.fav && vis) {
      const g = ctx.createRadialGradient(p.x, p.y, D * 0.3, p.x, p.y, D * 1.25);
      g.addColorStop(0, 'rgba(242,181,107,.38)'); g.addColorStop(1, 'rgba(242,181,107,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, D * 1.25, 0, TAU); ctx.fill();
    }
    if (vis && MS.audio.isPlaying(s)) {
      ctx.strokeStyle = MS.moodColor(s.mood, 72, 0.5 + bass * 0.4);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, D * (0.62 + bass * 0.3), 0, TAU); ctx.stroke();
    }

    ctx.globalAlpha = vis ? 1 : 0.16;
    const q = Math.max(16, Math.ceil(D * dpr / 0.94 / 8) * 8);
    const sp = MS.planets.sprite(s, q);
    const w = sp.width * (D / 0.94) / q;
    ctx.drawImage(sp, p.x - w / 2, p.y - w / 2, w, w);
    ctx.globalAlpha = 1;

    if (vis && selected === s.id) {
      ctx.save();
      ctx.setLineDash([4, 5]); ctx.lineDashOffset = -now * 0.02;
      ctx.strokeStyle = MS.moodColor(s.mood, 78, 0.95); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, D / 2 + 8, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (vis && focusId === s.id) {
      ctx.strokeStyle = 'rgba(244,241,234,.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, D / 2 + 5, 0, TAU); ctx.stroke();
    }
  }

  function drawFx(now) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      const e = (now - f.t0) / f.dur;

      if (f.k === 'comet') {
        const target = pos.find((p) => p.s.id === f.id);
        if (!target) { fx.splice(i, 1); continue; }
        if (e >= 1) {
          fx.splice(i, 1);
          fx.push({ k: 'ring', t0: now, dur: 800, x: target.x, y: target.y, h: MS.mood(target.s.mood).hue });
          continue;
        }
        const k = Math.pow(Math.max(e, 0), 1.7);
        const hx = U.lerp(f.x, target.x, k), hy = U.lerp(f.y, target.y, k);
        const dx = target.x - f.x, dy = target.y - f.y, len = Math.hypot(dx, dy) || 1;
        const tl = 150 * (1 - e * 0.3);
        const tx = hx - dx / len * tl, ty = hy - dy / len * tl;
        const g = ctx.createLinearGradient(hx, hy, tx, ty);
        g.addColorStop(0, 'rgba(244,241,234,.95)'); g.addColorStop(1, 'rgba(242,181,107,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = '#F4F1EA'; ctx.shadowColor = 'rgba(242,181,107,.95)'; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      } else if (f.k === 'ring') {
        if (e >= 1) { fx.splice(i, 1); continue; }
        const k = U.easeOut(e);
        ctx.strokeStyle = `hsl(${f.h} 90% 78% / ${1 - e})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, 10 + k * 60, 0, TAU); ctx.stroke();
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 40);
        g.addColorStop(0, `rgba(244,241,234,${0.7 * (1 - e)})`); g.addColorStop(1, 'rgba(244,241,234,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, 40, 0, TAU); ctx.fill();
      } else if (f.k === 'hole') {
        if (e >= 1) { fx.splice(i, 1); continue; }
        const a = Math.sin(Math.min(e, 1) * Math.PI), r = 8 + 20 * a;
        const g = ctx.createRadialGradient(geo.cx, geo.cy, 0, geo.cx, geo.cy, r * 2.2);
        g.addColorStop(0, `rgba(0,0,0,${0.95 * a})`); g.addColorStop(0.45, `rgba(0,0,0,${0.9 * a})`);
        g.addColorStop(0.5, `rgba(112,183,217,${0.55 * a})`); g.addColorStop(1, 'rgba(112,183,217,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(geo.cx, geo.cy, r * 2.2, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(geo.cx, geo.cy); ctx.rotate(e * 9);
        ctx.strokeStyle = `rgba(112,183,217,${0.8 * a})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, 4.2); ctx.stroke(); ctx.restore();
      }
    }
  }

  function updateTip() {
    const id = hoverId || focusId;
    const p = id && pos.find((q) => q.s.id === id);
    if (!p || !isVis(id) || p.sc < 0.5) { if (!tip.hidden) tip.hidden = true; tipKey = ''; return; }
    if (tipKey !== id) {
      tipKey = id;
      const m = MS.mood(p.s.mood);
      tip.innerHTML = `<strong>${U.esc(p.s.title)}</strong><span>${U.esc(p.s.artist || 'Artista desconhecido')}, ${m.name}</span>`;
      tip.hidden = false;
    }
    const below = p.y - p.r < 76;                 // perto do topo: abre embaixo
    tip.classList.toggle('below', below);
    tip.style.left = Math.round(U.clamp(p.x, 90, W - 90)) + 'px';
    tip.style.top = Math.round(below ? p.y + p.r + 10 : p.y - p.r - 8) + 'px';
  }

  function draw(now, dt) {
    if (!W) return;

    for (const [id, sk] of Array.from(sinking)) {
      if (now >= sk.t0 + sk.dur) { sinking.delete(id); sk.cb && sk.cb(); }
    }
    if (!U.reduce) {
      tScale += ((hoverId || focusId ? 0.08 : 1) - tScale) * 0.12;   // desacelera para facilitar o clique
      t += dt * tScale;
      insetCur += (inset - insetCur) * 0.14;
      if (Math.abs(inset - insetCur) < 0.5) insetCur = inset;
    } else insetCur = inset;

    build(now);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const bass = MS.audio.level.bass;
    const on = MS.MOODS.map(() => false);
    pos.forEach((p) => { if (isVis(p.s.id)) on[p.mood] = true; });

    /* órbitas e nomes */
    ctx.textAlign = 'center';
    ctx.font = `500 12px ${FONT}`;
    MS.MOODS.forEach((m, i) => {
      const rx = geo.rx(i), ry = rx * geo.ratio;
      ctx.strokeStyle = `hsl(${m.hue} 80% 74% / ${on[i] ? 0.28 : 0.1})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(geo.cx, geo.cy, rx, ry, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = `hsl(${m.hue} 85% 78% / ${on[i] ? 0.78 : 0.26})`;
      ctx.fillText('Órbita ' + (i + 1), geo.cx, geo.cy - ry - 8);
    });

    const back = pos.filter((p) => p.sn < 0).sort((a, b) => a.sn - b.sn);
    const front = pos.filter((p) => p.sn >= 0).sort((a, b) => a.sn - b.sn);
    back.forEach((p) => drawPlanet(p, now));

    /* sol */
    ctx.globalCompositeOperation = 'lighter';
    const sr = 46 + bass * 26;
    let g = ctx.createRadialGradient(geo.cx, geo.cy, 0, geo.cx, geo.cy, sr);
    g.addColorStop(0, 'rgba(244,241,234,.95)'); g.addColorStop(0.18, 'rgba(242,181,107,.6)'); g.addColorStop(1, 'rgba(242,181,107,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(geo.cx, geo.cy, sr, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    front.forEach((p) => drawPlanet(p, now));

    /* nome da música selecionada */
    const sp = selected && pos.find((p) => p.s.id === selected);
    if (sp && isVis(selected) && sp.sc > 0.5) {
      ctx.font = `italic 17px ${SERIF}`;
      ctx.fillStyle = '#F4F1EA';
      ctx.fillText(sp.s.title, sp.x, sp.y + sp.r + 28);
    }

    drawFx(now);
    updateTip();
  }

  /* ---------- laço ---------- */
  function loop(now) {
    if (!running) return;
    const dt = Math.min(50, now - last || 16); last = now;
    draw(now, dt);
    requestAnimationFrame(loop);
  }
  function start() { if (running || U.reduce) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
  function stop() { running = false; }
  function invalidate() {
    if (!U.reduce || queued) return;
    queued = true;
    requestAnimationFrame((now) => { queued = false; draw(now, 0); });
  }

  /* ---------- interação ---------- */
  function hit(e) {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    for (let i = pos.length - 1; i >= 0; i--) {
      const p = pos[i];
      if (!isVis(p.s.id) || p.sc < 0.5 || sinking.has(p.s.id)) continue;
      if (Math.hypot(p.x - x, p.y - y) <= p.r + 10) return p;
    }
    return null;
  }
  cv.addEventListener('pointermove', (e) => {
    const p = hit(e);
    hoverId = p ? p.s.id : null;
    cv.style.cursor = p ? 'pointer' : 'default';
    invalidate();
  });
  cv.addEventListener('pointerleave', () => { hoverId = null; cv.style.cursor = 'default'; invalidate(); });
  cv.addEventListener('click', (e) => {
    const p = hit(e);
    if (p) MS.emit('orbit:pick', p.s);
  });

  function visibleList() { return songs.filter((s) => isVis(s.id)); }
  cv.addEventListener('keydown', (e) => {
    const list = visibleList();
    if (!list.length) return;
    const i = list.findIndex((s) => s.id === focusId);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); focusId = list[(i + 1) % list.length].id; }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); focusId = list[(i - 1 + list.length) % list.length].id; }
    else if ((e.key === 'Enter' || e.key === ' ') && i >= 0) { e.preventDefault(); MS.emit('orbit:pick', list[i]); }
    else return;
    invalidate();
  });
  cv.addEventListener('focus', () => {
    if (!focusId && cv.matches(':focus-visible')) { const l = visibleList(); focusId = l[0] ? l[0].id : null; invalidate(); }
  });
  cv.addEventListener('blur', () => { focusId = null; invalidate(); });

  /* ---------- API ---------- */
  MS.orbit = {
    setSongs(list) { songs = list.slice(); invalidate(); },
    setVisible(set) { visible = set; invalidate(); },
    select(id) { selected = id; invalidate(); },
    setInset(px) { inset = px; invalidate(); },
    launchComet(song, done) {
      if (U.reduce) { spawn.delete(song.id); invalidate(); done && done(); return; }
      const now = performance.now(), dur = 950;
      spawn.set(song.id, now + dur);
      fx.push({ k: 'comet', id: song.id, t0: now, dur, x: -30, y: H * 0.08 });
      setTimeout(() => done && done(), dur + 300);
    },
    sink(id, done) {
      if (U.reduce) { done && done(); return; }
      const now = performance.now();
      sinking.set(id, { t0: now, dur: 850, cb: done });
      fx.push({ k: 'hole', t0: now, dur: 1100 });
    },
  };

  new ResizeObserver(resize).observe(box);
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(box);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  MS.on('audio:state', invalidate);
  resize();
})();
