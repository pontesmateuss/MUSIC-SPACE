/* ==========================================================
   Music Space — audio.js
   player (arquivos enviados + faixas demo geradas em tempo real)
   e analisador de espectro que alimenta galáxia, planeta e player
   ========================================================== */
(function () {
  'use strict';
  const MS = window.MS;
  const U = MS.util;

  let ctx = null, master, analyser, bus, reverb, el, objectUrl = null;
  let vol = 0.8;
  let cur = null;               // música atual
  let state = 'stopped';        // 'playing' | 'paused' | 'stopped'
  let gen = null;               // faixa gerada em andamento
  let genOffset = 0;            // posição (s) ao pausar uma faixa gerada
  let queueFn = () => [];
  let freq = new Uint8Array(128);
  const level = { v: 0, bass: 0 };

  /* parâmetros musicais por humor */
  const MODES = {
    energia:   { roots: [196, 220, 233.1], scale: [0, 2, 4, 7, 9],     chord: [0, 4, 7, 12],  prog: [0, 5, 7, 3],  wave: 'sawtooth', cut: 2300, chordEvery: 3.6, pluckMin: .28, pluckVar: .35, plk: .15 },
    foco:      { roots: [174.6, 196, 220], scale: [0, 2, 4, 7, 9],     chord: [0, 7, 12, 16],  prog: [0, 5, 3, 7],  wave: 'triangle', cut: 1500, chordEvery: 6,   pluckMin: .9,  pluckVar: 1.1, plk: .11 },
    noturno:   { roots: [110, 123.5, 130.8], scale: [0, 3, 5, 7, 10],  chord: [0, 7, 10, 15], prog: [0, 8, 5, 7],  wave: 'sawtooth', cut: 900,  chordEvery: 7.5, pluckMin: 1.4, pluckVar: 1.8, plk: .10 },
    nostalgia: { roots: [146.8, 164.8, 174.6], scale: [0, 2, 4, 5, 7, 9, 11], chord: [0, 4, 7, 11], prog: [0, 9, 5, 7], wave: 'triangle', cut: 1300, chordEvery: 6.8, pluckMin: 1.0, pluckVar: 1.4, plk: .12 },
    calma:     { roots: [130.8, 146.8, 164.8], scale: [0, 2, 4, 7, 9], chord: [0, 7, 14, 16], prog: [0, 7, 5, 0],  wave: 'sine',     cut: 1100, chordEvery: 9,   pluckMin: 2.2, pluckVar: 2.4, plk: .1 },
  };

  function impulse(seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = vol;
    analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.82;
    bus = ctx.createGain();
    bus.connect(master); master.connect(analyser); analyser.connect(ctx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);

    reverb = ctx.createConvolver(); reverb.buffer = impulse(3.4, 2.4);
    const rg = ctx.createGain(); rg.gain.value = 0.4;
    reverb.connect(rg); rg.connect(bus);

    el = new Audio(); el.preload = 'auto';
    ctx.createMediaElementSource(el).connect(bus);
    el.addEventListener('ended', () => next(true));
    el.addEventListener('loadedmetadata', () => {
      if (cur && isFinite(el.duration) && !cur.demo) { MS.store.update(cur.id, { dur: Math.round(el.duration) }); MS.emit('audio:meta', cur); }
    });
    requestAnimationFrame(tick);
  }

  /* ---------- faixa gerada ---------- */
  function startGen(song) {
    const P = MODES[song.mood] || MODES.noturno;
    const r = U.rng(song.seed);
    const root = P.roots[Math.floor(r() * P.roots.length)];
    const t0 = ctx.currentTime;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(1, t0 + 1.4);
    out.connect(bus);
    const send = ctx.createGain(); send.gain.value = 0.9;
    out.connect(send); send.connect(reverb);

    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.34 + r() * 0.22;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const dg = ctx.createGain(); dg.gain.value = 0.3;
    delay.connect(fb); fb.connect(delay); delay.connect(dg); dg.connect(out);

    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = P.cut; filt.Q.value = 0.7;
    filt.connect(out);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06 + r() * 0.05;
    const lg = ctx.createGain(); lg.gain.value = P.cut * 0.35;
    lfo.connect(lg); lg.connect(filt.frequency); lfo.start();

    const bass = ctx.createOscillator(); bass.type = 'sine'; bass.frequency.value = root / 2;
    const bg = ctx.createGain(); bg.gain.value = 0.17;
    bass.connect(bg); bg.connect(out); bass.start();

    let nextChord = t0 + 0.05, nextPluck = t0 + 1.2, chordIdx = 0;

    function chord(t) {
      const base = root * Math.pow(2, P.prog[chordIdx % P.prog.length] / 12); chordIdx++;
      const dur = P.chordEvery;
      P.chord.forEach((st, i) => {
        const o = ctx.createOscillator(); o.type = P.wave;
        o.frequency.value = base * Math.pow(2, st / 12);
        o.detune.value = (i % 2 ? 1 : -1) * (6 + r() * 6);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.07, t + dur * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.15);
        o.connect(g); g.connect(filt);
        o.start(t); o.stop(t + dur * 1.2);
      });
    }
    function pluck(t) {
      const deg = P.scale[Math.floor(r() * P.scale.length)];
      const oct = [1, 2, 2, 4][Math.floor(r() * 4)];
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = root * oct * Math.pow(2, deg / 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(P.plk, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 1.8);
      o.connect(g); g.connect(out); g.connect(delay);
      o.start(t); o.stop(t + 2);
    }
    const timer = setInterval(() => {
      const now = ctx.currentTime;
      while (nextChord < now + 0.6) { chord(nextChord); nextChord += P.chordEvery; }
      while (nextPluck < now + 0.6) { pluck(nextPluck); nextPluck += P.pluckMin + r() * P.pluckVar; }
    }, 180);

    gen = { out, timer, lfo, bass, startedAt: t0 };
  }

  function stopGen(fade) {
    if (!gen) return;
    const g = gen; gen = null;
    clearInterval(g.timer);
    const t = ctx.currentTime, f = fade == null ? 0.4 : fade;
    g.out.gain.cancelScheduledValues(t);
    g.out.gain.setValueAtTime(g.out.gain.value, t);
    g.out.gain.linearRampToValueAtTime(0, t + f);
    setTimeout(() => { try { g.lfo.stop(); g.bass.stop(); } catch (e) {} try { g.out.disconnect(); } catch (e) {} }, f * 1000 + 100);
  }

  /* ---------- controle ---------- */
  function position() {
    if (!cur) return 0;
    if (cur.demo) {
      if (state === 'playing' && gen) return genOffset + (ctx.currentTime - gen.startedAt);
      return genOffset;
    }
    return el ? el.currentTime || 0 : 0;
  }
  function duration() {
    if (!cur) return 0;
    if (cur.demo) return cur.dur || 180;
    return el && isFinite(el.duration) ? el.duration : cur.dur || 0;
  }

  async function play(song) {
    if (!song) return;
    ensure();
    if (ctx.state === 'suspended') await ctx.resume();

    if (cur && song.id === cur.id) {            // retomar
      if (state === 'playing') return;
      if (cur.demo) startGen(cur); else el.play();
      state = 'playing'; MS.emit('audio:state', { song: cur, state }); return;
    }
    if (!MS.store.playable(song)) { MS.emit('audio:nofile', song); return; }

    // trocar de música
    if (gen) stopGen(0.25);
    if (el) el.pause();
    cur = song; genOffset = 0;

    if (song.demo) {
      startGen(song);
    } else {
      let blob = null;
      try { blob = await MS.store.getBlob(song.id); } catch (e) {}
      if (!blob) { cur = null; state = 'stopped'; MS.emit('audio:error', song); MS.emit('audio:state', { song: null, state }); return; }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(blob);
      el.src = objectUrl;
      try { await el.play(); } catch (e) { MS.emit('audio:error', song); return; }
    }
    state = 'playing';
    MS.store.update(song.id, { plays: (song.plays || 0) + 1 });
    MS.emit('audio:state', { song: cur, state });
  }

  function pause() {
    if (!cur || state !== 'playing') return;
    if (cur.demo) { genOffset = position(); stopGen(0.3); } else el.pause();
    state = 'paused';
    MS.emit('audio:state', { song: cur, state });
  }

  function toggle(song) {
    if (song && (!cur || song.id !== cur.id)) return play(song);
    if (state === 'playing') pause(); else if (cur) play(cur);
  }

  function seek(frac) {
    if (!cur) return;
    const t = U.clamp(frac, 0, 1) * duration();
    if (cur.demo) {
      genOffset = t;
      if (state === 'playing') { stopGen(0.15); startGen(cur); }
    } else if (el && isFinite(el.duration)) el.currentTime = t;
  }

  function neighbor(dir) {
    const q = queueFn().filter(MS.store.playable);
    if (!q.length) return null;
    const i = cur ? q.findIndex((s) => s.id === cur.id) : -1;
    if (i < 0) return q[0];
    return q[(i + dir + q.length) % q.length];
  }
  function next(auto) {
    const n = neighbor(1);
    if (!n) return;
    if (auto && cur && n.id === cur.id) { seek(0); return; }
    cur = cur && n.id === cur.id ? null : cur;
    play(n);
  }
  function prev() {
    if (position() > 4) { seek(0); return; }
    const n = neighbor(-1);
    if (n) { if (cur && n.id === cur.id) cur = null; play(n); }
  }

  function setVolume(v) {
    vol = U.clamp(v, 0, 1);
    if (master) master.gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
  }

  /* ---------- análise (um quadro por vez) ---------- */
  function tick() {
    if (analyser) {
      analyser.getByteFrequencyData(freq);
      let all = 0, low = 0;
      for (let i = 0; i < freq.length; i++) all += freq[i];
      for (let i = 0; i < 6; i++) low += freq[i];
      const v = all / freq.length / 255, b = low / 6 / 255;
      level.v += (v - level.v) * 0.35;
      level.bass += (b - level.bass) * 0.35;
    }
    if (state === 'playing' && cur && cur.demo && position() >= duration()) next(true);
    requestAnimationFrame(tick);
  }

  MS.audio = {
    play, pause, toggle, seek, next, prev, setVolume, position, duration,
    setQueue: (fn) => { queueFn = fn; },
    get current() { return cur; },
    get state() { return state; },
    get freq() { return freq; },
    level,
    isPlaying: (s) => !!(cur && s && cur.id === s.id && state === 'playing'),
    forget: (id) => {                       // música removida
      if (cur && cur.id === id) {
        if (gen) stopGen(0.2);
        if (el) el.pause();
        cur = null; state = 'stopped'; genOffset = 0;
        MS.emit('audio:state', { song: null, state });
      }
    },
  };
})();
