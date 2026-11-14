/* Navigation and user-created playlists. Audio queue survives page changes. */
(function () {
  'use strict';
  const MS = window.MS, { $, $$, esc } = MS.util, model = MS.libraryModel;
  const key = 'musicspace.playlists.v1';
  let playlists = [], route = 'top', selectedId = null, editId = null, pendingTrack = null;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) playlists = saved.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.tracks)).map(p => ({ ...p, tracks: [...new Set(p.tracks.filter(id => typeof id === 'string'))] }));
  } catch { /* Keep the application available when storage is unavailable. */ }
  const titles = { top: 'Início', universo: 'Órbita', musicas: 'Músicas', playlists: 'Playlists' };
  const active = () => playlists.find(p => p.id === selectedId);
  const tracks = p => model.tracks(p, id => MS.store.get(id));
  const status = message => { $('#playlistStatus').textContent = message; };
  function save(updated) {
    try { localStorage.setItem(key, JSON.stringify(updated)); }
    catch { status('Não foi possível salvar. Verifique o espaço e as permissões do navegador.'); return false; }
    playlists = updated;
    return true;
  }
  function update(playlist) {
    return save(playlists.map(p => p.id === playlist.id ? playlist : p));
  }
  function play(song, playlist) {
    MS.audio.setQueue(playlist ? () => {
      const current = playlists.find(p => p.id === playlist.id);
      return current ? tracks(current) : [];
    } : MS.libraryQueue);
    MS.audio.toggle(song);
  }
  // Library playback resets the queue; navigation alone does not.
  MS.audio.setQueue(MS.libraryQueue);
  document.addEventListener('click', e => {
    if (e.target.closest('#rows [data-act="play"], #panel [data-act="play"], #heroPlanet')) MS.audio.setQueue(MS.libraryQueue);
  }, true);
  MS.on('orbit:pick', () => MS.audio.setQueue(MS.libraryQueue));

  function renderCollections() {
    if (route !== 'playlists') return;
    const playlist = active();
    $('#collectionsTitle').textContent = playlist ? playlist.name : 'Suas playlists';
    $('#collectionsDescription').textContent = playlist ? `${tracks(playlist).length} músicas · Criada por você` : 'Você escolhe o nome, as músicas e a ordem. Do seu jeito.';
    $('#collectionCards').hidden = !!playlist;
    $('#newPlaylist').hidden = !!playlist;
    $('#playlistDetail').hidden = !playlist;
    if (playlist) { renderDetail(playlist); return; }
    $('#collectionCards').innerHTML = playlists.length ? playlists.map(p => `<button type="button" class="collection-card" data-playlist="${esc(p.id)}"><span class="collection-art"><canvas width="128" height="128" aria-hidden="true"></canvas></span><strong>${esc(p.name)}</strong><small>${tracks(p).length} músicas · Sua playlist</small></button>`).join('') : '<div class="playlist-empty"><h3>Uma playlist com a sua cara.</h3><p>Crie sua primeira playlist e adicione as músicas que quiser. Nenhuma seleção automática.</p><button class="btn btn-primary" type="button" data-create>Criar minha primeira playlist</button></div>';
    $$('#collectionCards [data-playlist]').forEach(card => {
      const p = playlists.find(p => p.id === card.dataset.playlist);
      MS.planets.paint($('canvas', card), tracks(p)[0] || { seed: MS.util.hash(p.name), mood: 'noturno' }, 128);
    });
  }
  function renderDetail(p) {
    const songs = tracks(p), playable = songs.some(MS.store.playable);
    $('#playlistDetail').innerHTML = `<a class="btn btn-text" href="#playlists">← Todas as playlists</a>
      <div class="playlist-toolbar"><button class="btn btn-primary" data-action="play" ${playable ? '' : 'disabled'}>Reproduzir</button><button class="btn btn-ghost" data-action="rename">Editar nome</button><button class="btn btn-ghost" data-action="delete">Excluir playlist</button></div>
      <ol class="playlist-tracks">${songs.map((s, i) => `<li data-track="${esc(s.id)}"><span class="track-index">${i + 1}</span><button class="track-title" data-action="track-play" ${MS.store.playable(s) ? '' : 'disabled'} aria-label="Ouvir ${esc(s.title)}"><strong>${esc(s.title)}</strong><small>${esc(s.artist || 'Artista desconhecido')}</small></button><span class="track-duration">${s.dur ? MS.util.fmtTime(s.dur) : '—'}</span><div class="track-actions"><button class="icon-btn" data-action="up" aria-label="Mover ${esc(s.title)} para cima" ${i ? '' : 'disabled'}>↑</button><button class="icon-btn" data-action="down" aria-label="Mover ${esc(s.title)} para baixo" ${i < songs.length - 1 ? '' : 'disabled'}>↓</button><button class="icon-btn" data-action="remove" aria-label="Remover ${esc(s.title)} da playlist"><svg class="i"><use href="#i-close"/></svg></button></div></li>`).join('')}</ol>
      ${songs.length ? '' : '<p class="playlist-empty">Sua playlist está pronta para receber músicas. Encontre-as abaixo.</p>'}
      <section class="playlist-add"><h3>Vamos adicionar músicas?</h3><label class="search"><svg class="i" aria-hidden="true"><use href="#i-search"/></svg><input id="playlistSearch" type="search" placeholder="Buscar na sua biblioteca" aria-label="Buscar músicas para adicionar"></label><div id="playlistResults"></div><button class="btn btn-text" data-open-add>Importar novas músicas</button></section>`;
    $('#playlistSearch').addEventListener('input', renderResults);
    renderResults();
  }
  function renderResults() {
    const p = active(); if (!p) return;
    const norm = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const query = norm($('#playlistSearch').value);
    const songs = MS.store.all().filter(s => norm(`${s.title} ${s.artist || ''}`).includes(query));
    $('#playlistResults').innerHTML = songs.length ? songs.map(s => `<div class="playlist-result" data-track="${esc(s.id)}"><span><strong>${esc(s.title)}</strong><small>${esc(s.artist || 'Artista desconhecido')}</small></span><button class="btn btn-line btn-sm" data-action="add" ${p.tracks.includes(s.id) ? 'disabled' : ''}>${p.tracks.includes(s.id) ? 'Adicionada' : 'Adicionar'}</button></div>`).join('') : '<p>Nenhuma música encontrada. Importe músicas para começar.</p>';
  }
  function openEditor(playlist = null) {
    editId = playlist?.id || null;
    $('#playlistDialogTitle').textContent = playlist ? 'Editar playlist' : 'Criar playlist';
    $('#playlistForm').elements.playlistName.value = playlist?.name || '';
    $('#playlistDialogError').textContent = '';
    $('#playlistDialog').showModal();
    $('#playlistForm').elements.playlistName.focus();
  }
  $('#newPlaylist').addEventListener('click', () => { pendingTrack = null; openEditor(); });
  $('#cancelPlaylist').addEventListener('click', () => $('#playlistDialog').close());
  $('#playlistForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = e.currentTarget.elements.playlistName.value.trim();
    if (!name) { $('#playlistDialogError').textContent = 'Digite um nome para a playlist.'; return; }
    const original = playlists.find(p => p.id === editId);
    const p = original ? { ...original, name } : { id: MS.util.uid(), name, tracks: pendingTrack ? [pendingTrack] : [] };
    if (!(original ? update(p) : save([...playlists, p]))) { $('#playlistDialogError').textContent = 'Não foi possível salvar a playlist neste navegador.'; return; }
    pendingTrack = null;
    $('#playlistDialog').close();
    navigate('playlists/' + encodeURIComponent(p.id));
    status('Playlist salva.');
  });
  $('#collectionCards').addEventListener('click', e => {
    const card = e.target.closest('[data-playlist]');
    if (card) navigate('playlists/' + encodeURIComponent(card.dataset.playlist));
    if (e.target.closest('[data-create]')) { pendingTrack = null; openEditor(); }
  });
  $('#playlistDetail').addEventListener('click', e => {
    const button = e.target.closest('[data-action]'), p = active(); if (!button || !p) return;
    const action = button.dataset.action, id = button.closest('[data-track]')?.dataset.track;
    if (action === 'rename') { openEditor(p); return; }
    if (action === 'delete') {
      if (window.confirm(`Excluir a playlist “${p.name}”? Suas músicas continuarão na biblioteca.`) && save(playlists.filter(item => item.id !== p.id))) { navigate('playlists'); status('Playlist excluída. Suas músicas foram mantidas.'); }
      return;
    }
    if (action === 'play' || action === 'track-play') {
      const song = action === 'play' ? tracks(p).find(MS.store.playable) : MS.store.get(id);
      if (song) play(song, p); return;
    }
    const updated = action === 'add' ? model.add(p, id) : action === 'remove' ? model.remove(p, id) : model.move({ ...p, tracks: tracks(p).map(s => s.id) }, id, action === 'up' ? -1 : 1);
    const query = $('#playlistSearch').value;
    if (update(updated)) {
      renderCollections(); $('#playlistSearch').value = query; renderResults();
      const target = $$('#playlistDetail [data-track]').find(row => row.dataset.track === id)?.querySelector(`[data-action="${action}"]`);
      if (target && !target.disabled) target.focus(); else $('#playlistSearch').focus();
      status(action === 'add' ? 'Música adicionada.' : action === 'remove' ? 'Música removida da playlist. Ela continua na biblioteca.' : 'Ordem atualizada.');
    }
  });
  MS.playlists = { pick(id) {
    pendingTrack = id;
    $('#pickerOptions').innerHTML = playlists.map(p => `<button class="btn btn-line" data-pick="${esc(p.id)}" ${p.tracks.includes(id) ? 'disabled' : ''}>${esc(p.name)}${p.tracks.includes(id) ? ' · Adicionada' : ''}</button>`).join('') + '<button class="btn btn-primary" data-create>Criar playlist</button>';
    $('#playlistPicker').showModal();
  } };
  $('#closePicker').addEventListener('click', () => $('#playlistPicker').close());
  $('#pickerOptions').addEventListener('click', e => {
    const button = e.target.closest('[data-pick]');
    if (button) {
      const p = playlists.find(p => p.id === button.dataset.pick);
      if (p && update(model.add(p, pendingTrack))) { $('#playlistPicker').close(); pendingTrack = null; }
      else if (p) button.textContent = 'Não foi possível salvar. Tentar novamente';
    } else if (e.target.closest('[data-create]')) { $('#playlistPicker').close(); openEditor(); }
  });
  function show(path, focus = true) {
    const [next, id] = path.split('/');
    route = Object.hasOwn(titles, next) ? next : 'top';
    try { selectedId = route === 'playlists' && id ? decodeURIComponent(id) : null; } catch { selectedId = null; }
    const library = route === 'musicas' || route === 'universo';
    $$('[data-page]').forEach(section => { section.hidden = !(route === 'top' ? section.dataset.page === 'home' : library ? section.id === 'universo' : section.id === 'colecoes'); });
    $('[data-secondary]').hidden = route === 'top';
    document.body.dataset.route = route;
    if (library) {
      MS.library.open({ orbit: route === 'universo' });
      $('#uniTitle').textContent = titles[route];
      $('#uniTitle').nextElementSibling.textContent = route === 'universo' ? 'Seus planetas se distribuem por todas as órbitas. Escolha uma música e dê o play.' : 'Toda a sua música em um lugar. Dê o play ou adicione a uma playlist.';
    }
    status(''); renderCollections();
    $$('.nav-links a').forEach(a => {
      if (a.hash === '#' + (route === 'universo' ? 'musicas' : route)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = `${active() && route === 'playlists' ? active().name : titles[route]} · Music Space`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) {
      const heading = $('main [data-page]:not([hidden]) h1, main [data-page]:not([hidden]) h2');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
  }
  function navigate(path) {
    if (location.hash !== '#' + path) history.pushState(null, '', '#' + path);
    show(path);
  }
  MS.navigateLibrary = (options = {}) => navigate(options.orbit ? 'universo' : 'musicas');
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const path = link.getAttribute('href').slice(1);
    if (Object.hasOwn(titles, path.split('/')[0])) { e.preventDefault(); navigate(path); }
  });
  window.addEventListener('popstate', () => show(location.hash.slice(1)));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  MS.on('library:change', renderCollections);
  show(location.hash.slice(1) || 'top', false);
})();
