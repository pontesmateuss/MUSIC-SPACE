/* ==========================================================
   Music Space — app.js
   filtros, lista, painel, sistemas, player, modal de adicionar,
   toasts, nav e animações de entrada
   ========================================================== */
(function () {
  'use strict';
  const MS = window.MS;
  const U = MS.util;
  const $ = U.$, $$ = U.$$;
  const esc = U.esc;

  MS.store.load();

  const state = { mood: null, q: '', view: 'orbit', sel: null, collection: null };
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const safeUrl = (u) => /^https?:\/\//i.test(u || '');

  const el = {
    chips: $('#chips'), q: $('#q'), rows: $('#rows'), count: $('#count'),
    empty: $('#empty'), emptyList: $('#emptyList'), panel: $('#panel'),
    viewOrbit: $('#viewOrbit'), viewList: $('#viewList'),
    systems: $('#systems'), dock: $('#dock'), toasts: $('#toasts'),
    heroPlanet: $('#heroPlanet'), hint: $('#stageHint'),
  };

  /* ---------- dados filtrados ---------- */
  function matches(s) {
    if (state.collection && !state.collection.has(s.id)) return false;
    if (state.mood === 'fav' && !s.fav) return false;
    if (state.mood && state.mood !== 'fav' && s.mood !== state.mood) return false;
    if (state.q) {
      const hay = norm([s.title, s.artist, s.genre, MS.mood(s.mood).name].join(' '));
      if (!hay.includes(norm(state.q))) return false;
    }
    return true;
  }
  const visibleSongs = () => MS.store.all().filter(matches);
  const filtering = () => !!(state.mood || state.q || state.collection);
  MS.audio.setQueue(visibleSongs);

  /* ---------- chips ---------- */
  function buildChips() {
    const items = [{ id: null, name: 'Todos' }].concat(MS.MOODS, [{ id: 'fav', name: 'Favoritas' }]);
    el.chips.innerHTML = items.map((m) => {
      const c = m.hue != null ? `hsl(${m.hue} 85% 68%)` : 'var(--accent)';
      const dot = m.id === 'fav' ? '<svg class="i" aria-hidden="true"><use href="#i-star"/></svg>' : m.hue != null ? '<i></i>' : '';
      return `<button class="chip" type="button" data-mood="${m.id || ''}" style="--c:${c}" aria-pressed="false">${dot}${m.name}</button>`;
    }).join('');
  }
  function paintChips() {
    $$('.chip', el.chips).forEach((b) => {
      const id = b.dataset.mood || null;
      b.setAttribute('aria-pressed', String(id === state.mood));
    });
  }
  el.chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const id = b.dataset.mood || null;
    state.mood = state.mood === id ? null : id;
    refresh();
  });
  let qTimer = 0;
  el.q.addEventListener('input', () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { state.q = el.q.value.trim(); refresh(); }, 120);
  });

  /* ---------- modo de visualização ---------- */
  $$('.seg-btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  function setView(v) {
    state.view = v;
    $$('.seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    el.viewOrbit.hidden = v !== 'orbit';
    el.viewList.hidden = v !== 'list';
    if (v === 'list') closePanel();
    refresh();
  }

  /* ---------- lista ---------- */
  function rowHTML(s) {
    const m = MS.mood(s.mood), n = s.plays || 0;
    const playable = MS.store.playable(s), playing = MS.audio.isPlaying(s);
    const play = playable
      ? `<button class="icon-btn" type="button" data-act="play" aria-label="${playing ? 'Pausar' : 'Ouvir'} ${esc(s.title)}"><svg class="i"><use href="#i-${playing ? 'pause' : 'play'}"/></svg></button>`
      : '';
    const link = safeUrl(s.link)
      ? `<a class="icon-btn" href="${esc(s.link)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir link de ${esc(s.title)}"><svg class="i"><use href="#i-link"/></svg></a>`
      : '';
    return `<li class="row${MS.audio.current && MS.audio.current.id === s.id && MS.audio.state === 'playing' ? ' is-playing' : ''}" data-id="${esc(s.id)}">
      <canvas aria-hidden="true"></canvas>
      <div class="row-main">
        <div class="row-title"><span>${esc(s.title)}</span><i class="eq" aria-hidden="true"><b></b><b></b><b></b></i></div>
        <div class="row-artist">${esc(s.artist || 'Artista desconhecido')}</div>
      </div>
      <div class="row-mood" style="--c:hsl(${m.hue} 85% 68%)"><i></i>${m.name}</div>
      <div class="row-plays">${n} ${U.plural(n, 'vez', 'vezes')}</div>
      <div class="row-actions">
        ${play}${link}
        <button class="icon-btn${s.fav ? ' is-on' : ''}" type="button" data-act="fav" aria-pressed="${!!s.fav}" aria-label="${s.fav ? 'Tirar dos favoritos' : 'Favoritar'} ${esc(s.title)}"><svg class="i"><use href="#i-star"/></svg></button>
        <button class="icon-btn" type="button" data-act="remove" aria-label="Remover ${esc(s.title)}"><svg class="i"><use href="#i-trash"/></svg></button>
      </div>
    </li>`;
  }
  function renderRows() {
    if (state.view !== 'list') return;
    const list = visibleSongs();
    el.rows.innerHTML = list.map(rowHTML).join('');
    $$('.row', el.rows).forEach((r) => {
      const s = MS.store.get(r.dataset.id);
      if (s) MS.planets.paint($('canvas', r), s, 44);
    });
    el.emptyList.hidden = list.length > 0;
  }
  el.rows.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const row = b.closest('.row'); const s = MS.store.get(row.dataset.id); if (!s) return;
    if (b.dataset.act === 'play') MS.audio.toggle(s);
    else if (b.dataset.act === 'fav') toggleFav(s);
    else if (b.dataset.act === 'remove') removeSong(s, row);
  });

  /* ---------- sistemas (humores) ---------- */
  function buildSystems() {
    el.systems.innerHTML = MS.MOODS.map((m, i) => {
      const c = `hsl(${m.hue} 85% 68%)`;
      const path = 'M10 45a90 30 0 1 0 180 0a90 30 0 1 0 -180 0';
      const dots = [[4, 0], [6.5, -2.7], [5, -5.3]].map((d, k) => U.reduce
        ? `<circle cx="${40 + k * 55}" cy="${k === 1 ? 72 : 22}" r="${d[0]}" fill="${c}"/>`
        : `<circle r="${d[0]}" fill="${c}"><animateMotion dur="${8 + i * 0.7}s" begin="${d[1]}s" repeatCount="indefinite" path="${path}"/></circle>`).join('');
      return `<li class="sys-li"><button class="sys" type="button" data-mood="${m.id}" style="--c:${c}">
        <svg viewBox="0 0 200 90" aria-hidden="true"><ellipse cx="100" cy="45" rx="90" ry="30" fill="none" stroke="${c}" stroke-opacity=".4"/><circle cx="100" cy="45" r="4" fill="#F2B56B"/>${dots}</svg>
        <h3>${m.name}</h3><p>${m.desc}</p><span class="sys-count" data-count="${m.id}"></span>
      </button></li>`;
    }).join('');
  }
  function paintSystems() {
    const all = MS.store.all();
    MS.MOODS.forEach((m) => {
      const n = all.filter((s) => s.mood === m.id).length;
      const c = $(`[data-count="${m.id}"]`, el.systems);
      if (c) c.textContent = `${n} ${U.plural(n, 'música', 'músicas')}`;
    });
  }
  el.systems.addEventListener('click', (e) => {
    const b = e.target.closest('.sys'); if (!b) return;
    state.mood = b.dataset.mood; state.q = ''; el.q.value = '';
    refresh();
    MS.navigateLibrary({ mood: state.mood });
  });

  /* ---------- painel de detalhes ---------- */
  function panelHTML(s) {
    const m = MS.mood(s.mood), n = s.plays || 0;
    const playable = MS.store.playable(s), playing = MS.audio.isPlaying(s);
    const link = safeUrl(s.link);
    const note = playable ? '' : `<p class="note">${link ? 'Esta música guarda só o link. Abra o link para ouvir.' : 'Esta música não tem arquivo nem link. Adicione de novo com um arquivo para ouvir aqui.'}</p>`;
    return `
      <button class="icon-btn panel-x" type="button" data-act="close" aria-label="Fechar detalhes"><svg class="i"><use href="#i-close"/></svg></button>
      <div class="panel-planet" style="--h:${m.hue}"><canvas aria-hidden="true"></canvas></div>
      <h3>${esc(s.title)}</h3>
      <p class="artist">${esc(s.artist || 'Artista desconhecido')}</p>
      <div class="tags">
        <span class="tag" style="--c:hsl(${m.hue} 85% 68%)"><i></i>${m.name}</span>
        ${s.genre ? `<span class="tag">${esc(s.genre)}</span>` : ''}
        ${s.fav ? '<span class="tag">Favorita</span>' : ''}
      </div>
      <p class="stat">Ouvida ${n} ${U.plural(n, 'vez', 'vezes')}${s.dur ? `. Duração ${U.fmtTime(s.dur)}.` : '.'}</p>
      ${note}
      <div class="panel-actions">
        ${playable ? `<button class="btn btn-primary" type="button" data-act="play"><svg class="i"><use href="#i-${playing ? 'pause' : 'play'}"/></svg>${playing ? 'Pausar' : 'Ouvir'}</button>` : ''}
        <div class="row2">
          <button class="btn btn-line${s.fav ? ' is-on' : ''}" type="button" data-act="fav" aria-pressed="${!!s.fav}"><svg class="i"><use href="#i-star"/></svg>${s.fav ? 'Favorita' : 'Favoritar'}</button>
          ${link ? `<a class="btn btn-line" href="${esc(s.link)}" target="_blank" rel="noopener noreferrer"><svg class="i"><use href="#i-link"/></svg>Abrir link</a>` : '<span></span>'}
        </div>
        <button class="danger" type="button" data-act="remove">Remover música</button>
      </div>`;
  }
  function renderPanel() {
    const s = state.sel && MS.store.get(state.sel);
    if (!s) { closePanel(); return; }
    const wasOpen = el.panel.classList.contains('is-open');
    el.panel.innerHTML = panelHTML(s);
    MS.planets.paint($('canvas', el.panel), s, 156);
    if (!wasOpen) {
      el.panel.hidden = false;
      void el.panel.offsetWidth;
      el.panel.classList.add('is-open');
    }
    MS.orbit.setInset(window.innerWidth > 760 ? 392 : 0);
  }
  function closePanel() {
    state.sel = null;
    MS.orbit.select(null);
    MS.orbit.setInset(0);
    if (el.panel.hidden) return;
    el.panel.classList.remove('is-open');
    setTimeout(() => { if (!state.sel) el.panel.hidden = true; }, 420);
  }
  function selectSong(id) {
    state.sel = id;
    MS.orbit.select(id);
    renderPanel();
  }
  el.panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const s = state.sel && MS.store.get(state.sel);
    if (b.dataset.act === 'close') closePanel();
    else if (s && b.dataset.act === 'play') MS.audio.toggle(s);
    else if (s && b.dataset.act === 'fav') toggleFav(s);
    else if (s && b.dataset.act === 'remove') removeSong(s);
  });
  MS.on('orbit:pick', (s) => {
    const same = state.sel === s.id;
    selectSong(s.id);
    if (MS.store.playable(s)) MS.audio.toggle(s);
    else if (same) closePanel();
  });
  el.viewOrbit.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.sel) closePanel(); });

  /* ---------- ações ---------- */
  function toggleFav(s) {
    MS.store.update(s.id, { fav: !s.fav });
    refresh();
  }
  function removeSong(s, row) {
    const finish = () => {
      MS.audio.forget(s.id);
      const r = MS.store.remove(s.id);
      if (state.sel === s.id) closePanel();
      refresh();
      if (!r) return;
      let blobTimer = null;
      if (r.song.hasFile) blobTimer = setTimeout(() => MS.store.delBlob(r.song.id).catch(() => {}), 7000);
      toast('Música removida.', {
        action: 'Desfazer', ms: 6500,
        onAction: () => { clearTimeout(blobTimer); MS.store.restore(r.song, r.index); refresh(); },
      });
    };
    if (state.view === 'orbit') MS.orbit.sink(s.id, finish);
    else if (row && !U.reduce) { row.classList.add('is-sinking'); setTimeout(finish, 420); }
    else finish();
  }

  /* ---------- atualização geral ---------- */
  function refresh() {
    const all = MS.store.all();
    const vis = visibleSongs();
    MS.orbit.setSongs(all);
    MS.orbit.setVisible(filtering() ? new Set(vis.map((s) => s.id)) : null);
    paintChips(); paintSystems(); renderRows();
    MS.emit('library:change');
    if (state.sel) renderPanel();
    el.empty.hidden = all.length > 0;
    if (!all.length) el.count.textContent = '';
    else if (filtering()) el.count.textContent = vis.length ? `Mostrando ${vis.length} de ${all.length} ${U.plural(all.length, 'música', 'músicas')}.` : 'Nenhuma música encontrada. Limpe a busca ou escolha outro humor.';
    else el.count.textContent = `${all.length} ${U.plural(all.length, 'música', 'músicas')} no seu universo.`;
  }

  /* ---------- player ---------- */
  const dockEl = {
    title: $('#dockTitle'), artist: $('#dockArtist'), play: $('#btnPlay'),
    cur: $('#tCur'), dur: $('#tDur'), seek: $('#seek'), vol: $('#vol'),
    viz: $('#dockViz'), planet: $('#dockPlanet'),
  };
  let seeking = false, dockOn = false, tickOn = false;
  const fill = (inp) => inp.style.setProperty('--fill', (inp.value / inp.max * 100) + '%');

  function updateDock() {
    const s = MS.audio.current, playing = MS.audio.state === 'playing';
    if (!s) {
      dockOn = false;
      el.dock.classList.remove('is-on'); document.body.classList.remove('has-dock');
      setTimeout(() => { if (!dockOn) el.dock.hidden = true; }, 650);
    } else {
      dockOn = true;
      if (el.dock.hidden) { el.dock.hidden = false; void el.dock.offsetWidth; }
      el.dock.classList.add('is-on'); document.body.classList.add('has-dock');
      dockEl.title.textContent = s.title;
      dockEl.artist.textContent = s.artist || 'Artista desconhecido';
      MS.planets.paint(dockEl.planet, s, 44);
      dockEl.play.setAttribute('aria-label', playing ? 'Pausar' : 'Tocar');
      $('use', dockEl.play).setAttribute('href', playing ? '#i-pause' : '#i-play');
      if (!tickOn) { tickOn = true; requestAnimationFrame(uiTick); }
    }
    el.heroPlanet.classList.toggle('is-playing', !!s && playing);
    el.heroPlanet.setAttribute('aria-label', playing ? 'Pausar a faixa' : 'Ouvir uma faixa demo');
    el.hint.textContent = s && playing ? `Tocando ${s.title}. Toque de novo para pausar.` : 'Toque no planeta e ouça uma faixa.';
    $$('.row', el.rows).forEach((r) => {
      const on = !!s && playing && r.dataset.id === s.id;
      r.classList.toggle('is-playing', on);
      const u = $('[data-act="play"] use', r);
      if (u) u.setAttribute('href', on ? '#i-pause' : '#i-play');
    });
    if (state.sel) renderPanel();
  }

  const vctx = dockEl.viz.getContext('2d');
  function uiTick() {
    if (!dockOn) { tickOn = false; return; }
    const s = MS.audio.current;
    const d = MS.audio.duration(), p = MS.audio.position();
    dockEl.cur.textContent = U.fmtTime(p);
    dockEl.dur.textContent = d ? U.fmtTime(d) : '0:00';
    dockEl.seek.disabled = !d;
    if (!seeking && d) { dockEl.seek.value = Math.round(p / d * 1000); fill(dockEl.seek); }

    /* anel de barras que reage ao som */
    vctx.clearRect(0, 0, 144, 144);
    if (s) {
      const f = MS.audio.freq, N = 40, hue = MS.mood(s.mood).hue;
      vctx.lineCap = 'round'; vctx.lineWidth = 3;
      vctx.strokeStyle = `hsl(${hue} 90% 72%)`;
      for (let i = 0; i < N; i++) {
        const bin = 2 + (i < N / 2 ? i : N - 1 - i);
        const v = (f[bin] || 0) / 255;
        const len = 3 + v * 20, a = i / N * U.TAU - Math.PI / 2;
        vctx.beginPath();
        vctx.moveTo(72 + Math.cos(a) * 47, 72 + Math.sin(a) * 47);
        vctx.lineTo(72 + Math.cos(a) * (47 + len), 72 + Math.sin(a) * (47 + len));
        vctx.stroke();
      }
    }
    requestAnimationFrame(uiTick);
  }
  $('#btnPlay').addEventListener('click', () => { if (MS.audio.current) MS.audio.toggle(); });
  $('#btnPrev').addEventListener('click', () => MS.audio.prev());
  $('#btnNext').addEventListener('click', () => MS.audio.next());
  dockEl.seek.addEventListener('input', () => { seeking = true; fill(dockEl.seek); dockEl.cur.textContent = U.fmtTime(dockEl.seek.value / 1000 * MS.audio.duration()); });
  dockEl.seek.addEventListener('change', () => { MS.audio.seek(dockEl.seek.value / 1000); seeking = false; });
  dockEl.vol.addEventListener('input', () => { MS.audio.setVolume(dockEl.vol.value / 100); fill(dockEl.vol); });
  fill(dockEl.vol);

  MS.on('audio:state', updateDock);
  MS.on('audio:meta', () => { renderRows(); if (state.sel) renderPanel(); });
  MS.on('audio:error', () => toast('Não consegui abrir o arquivo desta música. Adicione ela de novo.'));
  MS.on('audio:nofile', () => toast('Esta música guarda só o link. Use “Abrir link” para ouvir.'));

  /* planeta do hero toca uma faixa demo */
  el.heroPlanet.addEventListener('click', () => {
    if (MS.audio.current) { MS.audio.toggle(); return; }
    const all = MS.store.all();
    const first = all.find((s) => s.id === 'demo-2') || all.find(MS.store.playable);
    if (first) MS.audio.play(first);
    else toast('Adicione uma música com arquivo para ouvir aqui.');
  });

  /* ---------- toasts ---------- */
  function toast(msg, o) {
    o = o || {};
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span>${esc(msg)}</span>${o.action ? `<button type="button">${esc(o.action)}</button>` : ''}`;
    el.toasts.appendChild(t);
    const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 360); };
    const timer = setTimeout(kill, o.ms || 4500);
    const b = $('button', t);
    if (b) b.addEventListener('click', () => { clearTimeout(timer); o.onAction && o.onAction(); kill(); });
    while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
  }

  /* ---------- modal: adicionar música ---------- */
  const modal = $('#addModal'), form = $('#addForm');
  const fileInput = $('#file'), drop = $('#drop'), fileName = $('#fileName');
  const prev = $('#previewPlanet');
  let opener = null, file = null, fileDur = 0, reroll = 0, prevQueued = false;

  $('#moodPick').innerHTML = MS.MOODS.map((m, i) =>
    `<label class="mood-opt"><input type="radio" name="mood" value="${m.id}"${m.id === 'noturno' ? ' checked' : ''}><span style="--c:hsl(${m.hue} 85% 68%)"><i></i>${m.name}</span></label>`).join('');

  function currentSeed() {
    const base = U.hash((form.title.value.trim().toLowerCase() || 'novo') + '|' + reroll);
    return base || 1;
  }
  function paintPreview() {
    if (prevQueued) return;
    prevQueued = true;
    requestAnimationFrame(() => {
      prevQueued = false;
      const mood = (form.mood.value || 'noturno');
      MS.planets.paint(prev, { id: 'preview', seed: currentSeed(), mood }, 220, { nocache: true });
    });
  }
  form.addEventListener('input', paintPreview);
  $('#reroll').addEventListener('click', () => { reroll++; paintPreview(); });

  function setFile(f) {
    if (!f) return;
    if (!/\.(mp3|wav|ogg|m4a|aac|flac|opus|mp4|m4v|webm|mov|mkv)$/i.test(f.name)) {
      toast('Escolha um arquivo de áudio ou vídeo, como MP3, WAV, M4A ou MP4.'); return;
    }
    file = f; fileDur = 0;
    fileName.textContent = f.name;
    drop.classList.add('has-file');
    if (!form.title.value.trim()) {
      form.title.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      paintPreview();
    }
    const url = URL.createObjectURL(f), a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => { if (isFinite(a.duration)) fileDur = Math.round(a.duration); URL.revokeObjectURL(url); };
    a.onerror = () => URL.revokeObjectURL(url);
    a.src = url;
  }
  $('#pick').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-drag'); }));
  drop.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));

  function openModal() {
    opener = document.activeElement;
    form.reset(); file = null; fileDur = 0; reroll = 0;
    drop.classList.remove('has-file');
    fileName.textContent = 'Ou arraste o arquivo para cá. Ele fica só neste navegador.';
    $$('.err', form).forEach((e) => (e.textContent = ''));
    $$('input', form).forEach((i) => i.removeAttribute('aria-invalid'));
    modal.hidden = false;
    document.documentElement.classList.add('lock');
    void modal.offsetWidth;
    modal.classList.add('is-open');
    paintPreview();
    setTimeout(() => form.title.focus(), 60);
  }
  function closeModal() {
    modal.classList.remove('is-open');
    document.documentElement.classList.remove('lock');
    setTimeout(() => { modal.hidden = true; }, 360);
    if (opener && opener.focus) opener.focus();
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-add]')) { e.preventDefault(); openModal(); }
    else if (e.target.closest('[data-close]') && !modal.hidden) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') {                       // mantém o foco dentro do modal
      const f = $$('button,input,a[href]', form).filter((x) => !x.disabled && x.offsetParent !== null && x.type !== 'file');
      if (!f.length) return;
      const first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
  });

  function fieldError(name, msg) {
    const input = form[name], err = $(`.err[data-for="${name}"]`, form);
    if (err) err.textContent = msg;
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = form.title.value.trim(), link = form.link.value.trim();
    let ok = true;
    fieldError('title', ''); fieldError('link', '');
    if (!title) { fieldError('title', 'Digite o nome da música.'); ok = false; }
    if (link && !safeUrl(link)) { fieldError('link', 'Cole um link completo, começando com https://'); ok = false; }
    if (!ok) { (form.querySelector('[aria-invalid="true"]') || form.title).focus(); return; }

    const song = MS.store.add({
      title, album: form.album.value.trim(), artist: form.artist.value.trim(), mood: form.mood.value, genre: form.genre.value.trim(),
      link, seed: currentSeed(), hasFile: !!file, fileName: file ? file.name : '', dur: fileDur,
    });
    if (file) {
      try { await MS.store.putBlob(song.id, file); }
      catch (err) {
        MS.store.update(song.id, { hasFile: false });
        toast('Não deu para salvar o arquivo neste navegador. A música foi guardada só com os dados.', { ms: 6500 });
      }
    }
    closeModal();
    state.mood = null; state.q = ''; el.q.value = '';
    refresh();
    MS.navigateLibrary({ orbit: true });
    const uni = $('#universo').getBoundingClientRect();
    const needScroll = uni.top > window.innerHeight * 0.6 || uni.bottom < window.innerHeight * 0.3;
    if (needScroll) $('#universo').scrollIntoView({ behavior: U.reduce ? 'auto' : 'smooth' });
    const delay = needScroll && !U.reduce ? 750 : 380;
    setTimeout(() => {
      if (state.view === 'orbit') MS.orbit.launchComet(song, () => selectSong(song.id));
      toast('Música guardada.');
    }, delay);
  });

  /* ---------- nav e entradas ---------- */
  const nav = $('#nav'), bar = $('#navProgress');
  function onScroll() {
    nav.classList.toggle('is-stuck', window.scrollY > 10);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty('--p', max > 0 ? U.clamp(window.scrollY / max, 0, 1).toFixed(4) : 0);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const stepIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-seen'); stepIO.unobserve(e.target); } });
  }, { threshold: 0.45 });
  $$('.step').forEach((s) => (U.reduce ? s.classList.add('is-seen') : stepIO.observe(s)));

  MS.library = {
    open(options = {}) {
      state.collection = options.ids ? new Set(options.ids) : null;
      state.mood = options.mood || null;
      state.q = ''; el.q.value = '';
      closePanel();
      setView(options.orbit ? 'orbit' : 'list');
    },
  };

  /* ---------- início ---------- */
  buildChips();
  buildSystems();
  refresh();
  MS.mood; // garante o namespace carregado
})();
