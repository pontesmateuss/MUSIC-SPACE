// Orbita · visão Galáxia. Canvas 2D com projeção 3D própria (sem dependências, funciona offline).
// Cada música é um planeta; favoritas viram estrelas. A lista/grade continua sendo a alternativa acessível.
const TAU = Math.PI * 2;
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };

export function createGalaxy({ root, getTracks, onPlay, isPlaying }) {
  const canvas = root.querySelector('canvas'), tip = root.querySelector('.galaxy-tip'), ctx = canvas.getContext('2d');
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || matchMedia('(max-width:700px)').matches;
  const dust = Array.from({ length: weak ? 160 : 420 }, (_, i) => ({ a: hash('a' + i) * TAU, r: .12 + hash('r' + i) * .95, y: (hash('y' + i) - .5) * .18, s: .4 + hash('s' + i) * 1.2 }));
  let bodies = [], w = 0, h = 0, dpr = 1, yaw = 0, tilt = .95, tYaw = 0, tTilt = .95, drag = null, hover = null, raf = 0, last = 0, open = false;
  const still = () => matchMedia('(prefers-reduced-motion:reduce)').matches || document.body.classList.contains('motion-paused');

  function layout() {
    // Órbita = artista (planetas do mesmo artista dividem anel); cor = hue do artista; tamanho = favorita/duração.
    const tracks = getTracks(), artists = [...new Set(tracks.map(t => t.artist))];
    bodies = tracks.map((t, i) => {
      const ring = artists.indexOf(t.artist), n = Math.max(1, artists.length);
      return { t, orbit: .22 + (ring + 1) / (n + 1) * .72, a: hash(t.id + 'p') * TAU, speed: .00006 / (.4 + ring * .35 + hash(t.id) * .2),
        size: t.favorite ? 9 : 5 + hash(t.id + 's') * 4, hue: Math.round(hash(t.artist) * 300 + 180) % 360, fav: !!t.favorite, x: 0, y: 0, z: 0, i };
    });
    root.querySelector('.galaxy-count').textContent = `${bodies.length} ${bodies.length === 1 ? 'corpo celeste' : 'corpos celestes'}`;
  }
  function resize() { dpr = Math.min(devicePixelRatio || 1, weak ? 1.25 : 2); w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function project(a, r, y) {
    const R = Math.min(w, h) * .46 * r, x0 = Math.cos(a + yaw) * R, z0 = Math.sin(a + yaw) * R, y0 = y * R;
    const y1 = y0 * Math.cos(tilt) - z0 * Math.sin(tilt), z1 = y0 * Math.sin(tilt) + z0 * Math.cos(tilt), p = 900 / (900 - z1);
    return { x: w / 2 + x0 * p, y: h / 2 + y1 * p, z: z1, p };
  }
  function frame(now) {
    raf = open ? requestAnimationFrame(frame) : 0; // pausa fora da tela
    const dt = Math.min(48, now - last); last = now;
    if (!still()) { if (!drag) tYaw += dt * .00008; for (const b of bodies) b.a += b.speed * dt; }
    yaw += (tYaw - yaw) * .08; tilt += (tTilt - tilt) * .08;
    ctx.clearRect(0, 0, w, h);
    const core = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * .3);
    core.addColorStop(0, 'rgba(255,214,150,.55)'); core.addColorStop(.35, 'rgba(188,120,255,.18)'); core.addColorStop(1, 'transparent');
    ctx.fillStyle = core; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(200,215,255,.55)';
    for (const d of dust) { const p = project(d.a + yaw * .3, d.r, d.y); ctx.globalAlpha = .25 + p.p * .25; ctx.fillRect(p.x, p.y, d.s, d.s); }
    ctx.globalAlpha = 1;
    for (const b of bodies) { const p = project(b.a, b.orbit, 0); b.x = p.x; b.y = p.y; b.z = p.z; b.p = p.p; }
    const order = [...bodies].sort((a, b) => a.z - b.z), playing = isPlaying();
    for (const b of order) {
      const r = b.size * b.p * (b === hover ? 1.7 : 1), on = playing === b.t.id;
      const g = ctx.createRadialGradient(b.x - r * .3, b.y - r * .3, r * .1, b.x, b.y, r * (b.fav || on ? 3.2 : 1.1));
      g.addColorStop(0, `hsl(${b.hue} 90% ${b.fav ? 88 : 68}%)`); g.addColorStop(b.fav || on ? .3 : .75, `hsl(${b.hue} 70% 45%)`); g.addColorStop(1, b.fav || on ? 'transparent' : `hsl(${b.hue} 60% 18%)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r * (b.fav || on ? 3.2 : 1), 0, TAU); ctx.fill();
      if (on) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(b.x, b.y, r * 2, r * .8, .4, 0, TAU); ctx.stroke(); }
    }
  }
  const pick = (x, y) => bodies.filter(b => Math.hypot(b.x - x, b.y - y) < Math.max(12, b.size * b.p * 1.6)).sort((a, b) => b.z - a.z)[0] || null;
  const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; tYaw += dx * .006; tTilt = Math.max(.35, Math.min(1.4, tTilt + dy * .004)); drag.x = e.clientX; drag.y = e.clientY; return; }
    const [x, y] = pos(e); hover = pick(x, y); canvas.style.cursor = hover ? 'pointer' : 'grab';
    tip.hidden = !hover; if (hover) { tip.textContent = ''; const s = document.createElement('strong'); s.textContent = hover.t.title; tip.append(s, document.createElement('br'), hover.t.artist); tip.style.transform = `translate(${x + 14}px,${y + 14}px)`; }
  });
  canvas.addEventListener('pointerup', e => { const moved = drag?.moved; drag = null; if (!moved) { const b = pick(...pos(e)); if (b) onPlay(b.t.id, bodies.map(x => x.t.id)); } });
  canvas.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; });
  new ResizeObserver(() => { resize(); }).observe(canvas);
  return {
    update() { layout(); if (!open) return; },
    show() { open = true; root.hidden = false; resize(); layout(); if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    hide() { open = false; root.hidden = true; },
    get open() { return open; }
  };
}
