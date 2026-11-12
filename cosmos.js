/* ==========================================================
   Music Space — core.js
   utilidades, humores, renderizador de planetas e armazenamento
   ========================================================== */
(function () {
  'use strict';
  const MS = (window.MS = window.MS || {});

  /* ---------- utilidades ---------- */
  const U = (MS.util = {
    TAU: Math.PI * 2,
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    gauss: () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2,
    easeOut: (t) => 1 - Math.pow(1 - t, 3),
    easeIn: (t) => t * t * t,
    easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeOutBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    hash(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    },
    rng(seed) {
      let a = seed | 0;
      return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    fmtTime(s) {
      s = Math.max(0, Math.floor(s || 0));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },
    $: (s, r) => (r || document).querySelector(s),
    $$: (s, r) => Array.from((r || document).querySelectorAll(s)),
    uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    plural: (n, one, many) => (n === 1 ? one : many),
  });

  /* ---------- eventos ---------- */
  const listeners = {};
  MS.on = (e, fn) => { (listeners[e] = listeners[e] || []).push(fn); };
  MS.emit = (e, d) => { (listeners[e] || []).forEach((fn) => fn(d)); };

  /* ---------- humores (cada um é uma órbita) ---------- */
  MS.MOODS = [
    { id: 'energia',   name: 'Energia',   hue: 28,  desc: 'Para treinar, correr e sair de casa.' },
    { id: 'foco',      name: 'Foco',      hue: 205, desc: 'Para estudar, programar e não se perder.' },
    { id: 'noturno',   name: 'Noturno',   hue: 262, desc: 'Para a madrugada e a luz baixa.' },
    { id: 'nostalgia', name: 'Nostalgia', hue: 330, desc: 'Para lembrar de um lugar ou de alguém.' },
    { id: 'calma',     name: 'Calma',     hue: 165, desc: 'Para respirar fundo e desacelerar.' },
  ];
  MS.mood = (id) => MS.MOODS.find((m) => m.id === id) || MS.MOODS[2];
  MS.moodIndex = (id) => Math.max(0, MS.MOODS.findIndex((m) => m.id === id));
  MS.moodColor = (id, l, a) => `hsl(${MS.mood(id).hue} 85% ${l || 68}% / ${a == null ? 1 : a})`;

  /* ---------- planetas procedurais ---------- */
  MS.planets = (function () {
    const cache = new Map();
    const hsl = (h, s, l, a) => `hsla(${(h + 360) % 360},${s}%,${l}%,${a == null ? 1 : a})`;

    function describe(song) {
      const r = U.rng(song.seed || 1);
      const m = MS.mood(song.mood);
      const hue = (m.hue + (r() - 0.5) * 44 + 360) % 360;
      const hue2 = (hue + (r() - 0.5) * 70 + 360) % 360;
      const roll = r();
      const kind = roll < 0.4 ? 'gas' : roll < 0.62 ? 'rocky' : roll < 0.8 ? 'ice' : 'lava';
      return {
        hue, hue2, kind,
        ring: r() < 0.3,
        bands: 9 + Math.floor(r() * 8),
        seed: Math.floor(r() * 1e9),
        sat: 48 + r() * 30,
        tilt: -0.28 - r() * 0.2,
      };
    }

    function render(size, d) {
      const C = d.ring ? Math.round(size * 1.9) : size;
      const cv = document.createElement('canvas');
      cv.width = cv.height = C;
      const c = cv.getContext('2d');
      const R = size * 0.47, cx = C / 2, cy = C / 2;
      const r = U.rng(d.seed);

      /* halo */
      const HO = Math.min(R * 1.32, C / 2);          // nunca passa da borda do canvas (evita recorte quadrado)
      let g = c.createRadialGradient(cx, cy, R * 0.9, cx, cy, HO);
      g.addColorStop(0, hsl(d.hue, 85, 70, 0.3));
      g.addColorStop(1, hsl(d.hue, 85, 70, 0));
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, HO, 0, U.TAU); c.fill();

      const ringHalf = (front) => {
        c.save(); c.translate(cx, cy); c.rotate(d.tilt);
        const rx = R * 1.85, ry = R * 0.44;
        [[1.0, R * 0.07, 0.3], [0.92, R * 0.13, 0.46], [0.82, R * 0.05, 0.22]].forEach(([k, w, a]) => {
          c.beginPath();
          c.ellipse(0, 0, rx * k, ry * k, 0, front ? 0 : Math.PI, front ? Math.PI : U.TAU);
          c.lineWidth = w; c.strokeStyle = hsl(d.hue2, 40, 82, a); c.stroke();
        });
        c.restore();
      };
      if (d.ring) ringHalf(false);

      /* esfera */
      c.save();
      c.beginPath(); c.arc(cx, cy, R, 0, U.TAU); c.clip();
      g = c.createLinearGradient(cx, cy - R, cx, cy + R);
      g.addColorStop(0, hsl(d.hue, d.sat, 64));
      g.addColorStop(1, hsl(d.hue2, d.sat, 36));
      c.fillStyle = g; c.fillRect(cx - R, cy - R, R * 2, R * 2);

      if (d.kind === 'gas' || d.kind === 'ice') {
        for (let i = 0; i < d.bands; i++) {
          const y = cy - R + (i / d.bands) * R * 2 + (r() - 0.5) * R * 0.12;
          const th = R * (0.08 + r() * 0.22);
          const l = d.kind === 'ice' ? 70 + r() * 22 : 28 + r() * 50;
          const hh = d.hue + (r() - 0.5) * 40;
          const amp = R * (0.015 + r() * 0.05), fr = 2 + r() * 4, ph = r() * 6.28;
          c.beginPath();
          for (let x = -R; x <= R; x += R / 16) {
            const yy = y + Math.sin((x / R) * fr + ph) * amp;
            if (x === -R) c.moveTo(cx + x, yy); else c.lineTo(cx + x, yy);
          }
          for (let x = R; x >= -R; x -= R / 16) c.lineTo(cx + x, y + th + Math.sin((x / R) * fr + ph + 0.6) * amp);
          c.closePath();
          c.fillStyle = hsl(hh, d.kind === 'ice' ? 30 : 55 + r() * 20, l, 0.22 + r() * 0.3);
          c.fill();
        }
        if (d.kind === 'gas' && r() < 0.6) {
          c.beginPath();
          c.ellipse(cx + (r() - 0.5) * R * 0.9, cy + (r() - 0.2) * R * 0.6, R * 0.16, R * 0.09, 0, 0, U.TAU);
          c.fillStyle = hsl(d.hue2, 70, 78, 0.5); c.fill();
        }
      } else {
        if (d.kind === 'lava') { c.fillStyle = 'rgba(30,10,8,.62)'; c.fillRect(cx - R, cy - R, R * 2, R * 2); }
        for (let i = 0; i < 46; i++) {
          const x = cx + (r() - 0.5) * R * 2, y = cy + (r() - 0.5) * R * 2, rr = R * (0.05 + r() * 0.2);
          const light = r() < 0.5;
          const gg = c.createRadialGradient(x, y, 0, x, y, rr);
          gg.addColorStop(0, hsl(d.hue, d.sat - 10, light ? 72 : 22, 0.38));
          gg.addColorStop(1, hsl(d.hue, d.sat - 10, light ? 72 : 22, 0));
          c.fillStyle = gg; c.beginPath(); c.arc(x, y, rr, 0, U.TAU); c.fill();
        }
        if (d.kind === 'rocky') {
          c.lineWidth = Math.max(1, R * 0.02); c.strokeStyle = hsl(d.hue, 30, 20, 0.36);
          for (let i = 0; i < 9; i++) {
            c.beginPath();
            c.ellipse(cx + (r() - 0.5) * R * 1.5, cy + (r() - 0.5) * R * 1.5, R * (0.05 + r() * 0.11), R * (0.04 + r() * 0.08), 0, 0, U.TAU);
            c.stroke();
          }
        } else {
          c.strokeStyle = 'rgba(255,150,70,.9)'; c.lineWidth = Math.max(1, R * 0.025);
          c.shadowColor = 'rgba(255,120,40,.9)'; c.shadowBlur = R * 0.12;
          for (let i = 0; i < 8; i++) {
            let x = cx + (r() - 0.5) * R * 1.6, y = cy + (r() - 0.5) * R * 1.6;
            c.beginPath(); c.moveTo(x, y);
            for (let k = 0; k < 5; k++) { x += (r() - 0.5) * R * 0.5; y += (r() - 0.5) * R * 0.5; c.lineTo(x, y); }
            c.stroke();
          }
          c.shadowBlur = 0;
        }
      }

      /* luz e terminador */
      g = c.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.05, cx - R * 0.38, cy - R * 0.42, R * 1.75);
      g.addColorStop(0, 'rgba(255,255,255,.34)');
      g.addColorStop(0.28, 'rgba(255,255,255,0)');
      g.addColorStop(0.62, 'rgba(6,5,22,.28)');
      g.addColorStop(1, 'rgba(6,5,22,.9)');
      c.fillStyle = g; c.fillRect(cx - R, cy - R, R * 2, R * 2);
      c.restore();

      /* aro de atmosfera */
      c.save(); c.globalCompositeOperation = 'lighter';
      c.lineWidth = Math.max(1, R * 0.035);
      const rg = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rg.addColorStop(0, hsl(d.hue, 90, 80, 0.55)); rg.addColorStop(0.5, hsl(d.hue, 90, 70, 0.08)); rg.addColorStop(1, hsl(d.hue, 90, 60, 0));
      c.strokeStyle = rg; c.beginPath(); c.arc(cx, cy, R - c.lineWidth / 2, 0, U.TAU); c.stroke();
      c.restore();

      if (d.ring) ringHalf(true);
      return cv;
    }

    function sprite(song, size, opt) {
      if (opt && opt.nocache) return render(size, describe(song));
      const key = song.id + '|' + song.seed + '|' + song.mood + '|' + size;
      let s = cache.get(key);
      if (!s) { s = render(size, describe(song)); cache.set(key, s); }
      return s;
    }

    /* desenha o planeta num canvas existente (tamanho css) */
    function paint(target, song, css, opt) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.round(css * dpr);
      if (target.width !== px) { target.width = px; target.height = px; }
      const c = target.getContext('2d');
      c.clearRect(0, 0, px, px);
      c.drawImage(sprite(song, px, opt), 0, 0, px, px);
    }

    return { describe, sprite, paint };
  })();

  /* ---------- armazenamento ---------- */
  MS.store = (function () {
    const KEY = 'musicspace.songs.v1';
    let songs = [];
    let mem = false; // sem localStorage

    const DEMO = [
      ['Maré de Vênus', 'Lia Nebulosa', 'calma', 'Ambient', true, 18],
      ['Poeira de Andrômeda', 'Orquestra do Vácuo', 'noturno', 'Trilha', false, 9],
      ['Noite em Titã', 'Marcos Ventura', 'noturno', 'Synthwave', true, 31],
      ['Cinturão', 'Radar Lunar', 'energia', 'Eletrônica', false, 22],
      ['Luz de Sírius', 'Aurora Delta', 'foco', 'Lo-fi', false, 14],
      ['Órbita Baixa', 'Satélite Azul', 'foco', 'Ambient', false, 7],
      ['Eclipse às 4h', 'Lia Nebulosa', 'noturno', 'Downtempo', false, 12],
      ['Aurora Boreal', 'Fiorde', 'calma', 'Ambient', true, 27],
      ['Vento Solar', 'Radar Lunar', 'energia', 'Synthwave', false, 16],
      ['Saturno em Casa', 'Tio Cometa', 'nostalgia', 'MPB espacial', true, 40],
      ['Cometa Verde', 'Tio Cometa', 'nostalgia', 'Indie', false, 11],
      ['Silêncio de Marte', 'Fiorde', 'calma', 'Piano', false, 5],
      ['Pulso 128', 'Satélite Azul', 'energia', 'House', false, 8],
    ];

    function demoSongs() {
      const now = Date.now();
      return DEMO.map((d, i) => ({
        id: 'demo-' + i, title: d[0], artist: d[1], mood: d[2], genre: d[3], link: '',
        hasFile: false, fileName: '', fav: d[4], plays: d[5], seed: U.hash(d[0]),
        demo: true, added: now - i * 86400000, dur: 150 + ((U.hash(d[0]) % 90)),
      }));
    }

    function save() {
      if (mem) return;
      try { localStorage.setItem(KEY, JSON.stringify(songs)); } catch (e) { mem = true; }
    }

    function load() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { mem = true; }
      if (raw) {
        try { songs = JSON.parse(raw) || []; } catch (e) { songs = []; }
      } else {
        songs = demoSongs();
        save();
      }
      return songs;
    }

    /* áudio enviado pelo usuário vai para o IndexedDB */
    let dbp = null;
    function db() {
      if (dbp) return dbp;
      dbp = new Promise((res, rej) => {
        try {
          const rq = indexedDB.open('musicspace', 1);
          rq.onupgradeneeded = () => rq.result.createObjectStore('audio');
          rq.onsuccess = () => res(rq.result);
          rq.onerror = () => rej(rq.error);
        } catch (e) { rej(e); }
      });
      return dbp;
    }
    function tx(mode, fn) {
      return db().then((d) => new Promise((res, rej) => {
        const t = d.transaction('audio', mode);
        const rq = fn(t.objectStore('audio'));
        t.oncomplete = () => res(rq && rq.result);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      }));
    }

    return {
      load,
      all: () => songs,
      get: (id) => songs.find((s) => s.id === id),
      save,
      playable: (s) => !!(s && (s.demo || s.hasFile)),
      add(data) {
        const s = Object.assign({
          id: U.uid(), title: '', artist: '', mood: 'noturno', genre: '', link: '',
          hasFile: false, fileName: '', fav: false, plays: 0, seed: 1, demo: false, added: Date.now(), dur: 0,
        }, data);
        songs.unshift(s); save(); return s;
      },
      update(id, patch) {
        const s = songs.find((x) => x.id === id);
        if (s) { Object.assign(s, patch); save(); }
        return s;
      },
      remove(id) {
        const i = songs.findIndex((s) => s.id === id);
        if (i < 0) return null;
        const [song] = songs.splice(i, 1);
        save();
        return { song, index: i };
      },
      restore(song, index) {
        songs.splice(Math.min(index, songs.length), 0, song);
        save();
      },
      putBlob: (id, blob) => tx('readwrite', (st) => st.put(blob, id)),
      getBlob: (id) => tx('readonly', (st) => st.get(id)),
      delBlob: (id) => tx('readwrite', (st) => st.delete(id)),
    };
  })();
})();
