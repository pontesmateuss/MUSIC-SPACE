/* Navegação sem recarregar a página: o áudio continua entre as áreas. */
(function () {
  'use strict';
  const MS = window.MS, { $, $$, esc } = MS.util;
  const key = 'musicspace.playlists.v1';
  let playlists = [];
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) playlists = saved.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.tracks));
  } catch { /* Biblioteca continua disponível sem armazenamento. */ }
  let route = '', groups = [];
  const titles = { top: 'Início', universo: 'Meu universo', musicas: 'Músicas', favoritas: 'Favoritas', playlists: 'Playlists', albuns: 'Álbuns', artistas: 'Artistas', sistemas: 'Humores', 'como-funciona': 'Como funciona' };
  const libraryRoutes = ['universo', 'musicas', 'favoritas'];
  const collectionRoutes = ['playlists', 'albuns', 'artistas'];

  function renderCollections() {
    if (!collectionRoutes.includes(route)) return;
    const songs = MS.store.all();
    $('#collectionsTitle').textContent = titles[route];
    $('#collectionsDescription').textContent = {
      playlists: 'Suas seleções e uma trilha para cada humor. Escolha uma coleção para ouvir.',
      albuns: 'Seus discos em um só lugar. Informe o álbum ao adicionar uma música.',
      artistas: 'Encontre cada voz e cada som da sua biblioteca.',
    }[route];
    if (route === 'playlists') {
      groups = playlists.map(p => ({ name: p.name, detail: 'Sua playlist', ids: p.tracks.filter(id => MS.store.get(id)) }));
      groups.push(...MS.MOODS.map(m => ({ name: m.name, detail: 'Seleção por humor', ids: songs.filter(s => s.mood === m.id).map(s => s.id) })));
    } else {
      const grouped = new Map();
      songs.forEach(s => {
        const artist = s.artist || 'Artista desconhecido';
        const name = route === 'artistas' ? artist : (s.album || 'Sem álbum');
        const id = route === 'artistas' ? artist : JSON.stringify([name, s.album ? artist : '']);
        if (!grouped.has(id)) grouped.set(id, { name, detail: route === 'albuns' ? (s.album ? artist : 'Músicas sem álbum informado') : 'Artista', ids: [] });
        grouped.get(id).ids.push(s.id);
      });
      groups = [...grouped.values()];
    }
    $('#collectionCards').innerHTML = groups.length ? groups.map((g, i) => `<button type="button" class="collection-card" data-collection="${i}"><span class="collection-art"><canvas width="128" height="128" aria-hidden="true"></canvas></span><strong>${esc(g.name)}</strong><span>${esc(g.detail)}</span><small>${g.ids.length} ${g.ids.length === 1 ? 'música' : 'músicas'}</small></button>`).join('') : '<p class="collection-empty">Sua coleção começa com uma música. Use “Adicionar música” no header.</p>';
    $$('.collection-card').forEach((card, i) => {
      const song = MS.store.get(groups[i].ids[0]) || { seed: MS.util.hash(groups[i].name), mood: 'noturno' };
      MS.planets.paint($('canvas', card), song, 128);
    });
    $('#playlistForm').hidden = route !== 'playlists';
    // Preserve as escolhas enquanto a reprodução atualiza a biblioteca.
    const selected = new Set($$('#playlistSongs input:checked').map(el => el.value));
    $('#playlistSongs').innerHTML = songs.map(s => `<label><input type="checkbox" value="${esc(s.id)}"${selected.has(s.id) ? ' checked' : ''}><span>${esc(s.title)}<small>${esc(s.artist || 'Artista desconhecido')}</small></span></label>`).join('');
  }

  function show(next, options = {}, focus = true) {
    route = Object.hasOwn(titles, next) ? next : 'top';
    const library = libraryRoutes.includes(route);
    const collection = collectionRoutes.includes(route);
    $$('[data-page]').forEach(section => {
      section.hidden = !(route === 'top' ? section.dataset.page === 'home' : library ? section.id === 'universo' : collection ? section.id === 'colecoes' : section.id === route);
    });
    $('[data-secondary]').hidden = route === 'top';
    document.body.dataset.route = route;
    if (library) {
      MS.library.open({ orbit: route === 'universo', mood: route === 'favoritas' ? 'fav' : null, ...options });
      $('#uniTitle').textContent = options.title || titles[route];
      $('#uniTitle').nextElementSibling.textContent = route === 'universo' ? 'Cada música é um planeta. Explore as órbitas, escolha um humor e dê o play.' : 'Suas músicas, sempre por perto. Busque, filtre e escolha o que ouvir.';
    }
    renderCollections();
    $$('.nav-links a').forEach(a => {
      if (a.hash === '#' + route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    $('.nav-more').open = false;
    document.title = `${titles[route]} · Music Space`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) {
      const heading = $('main [data-page]:not([hidden]) h1, main [data-page]:not([hidden]) h2');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
  }
  function navigate(next, options) {
    if (location.hash !== '#' + next) history.pushState(null, '', '#' + next);
    show(next, options);
  }
  MS.navigateLibrary = (options = {}) => navigate(options.orbit ? 'universo' : 'musicas', options);
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const next = link.getAttribute('href').slice(1);
    if (Object.hasOwn(titles, next)) { e.preventDefault(); navigate(next); }
    else if (!e.target.closest('.nav-more')) $('.nav-more').open = false;
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('.nav-more').open = false; });
  $('#collectionCards').addEventListener('click', e => {
    const card = e.target.closest('[data-collection]');
    if (!card) return;
    const group = groups[Number(card.dataset.collection)];
    // O hash guarda a seleção para recarregar e usar voltar/avançar.
    const source = route;
    const index = Number(card.dataset.collection);
    history.pushState(null, '', `#${source}/${index}`);
    show('musicas', { ids: group.ids, title: group.name });
  });
  $('#playlistForm').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.currentTarget, name = form.elements.playlistName.value.trim();
    if (!name) return;
    const tracks = $$('#playlistSongs input:checked').map(input => input.value);
    const updated = [...playlists, { id: MS.util.uid(), name, tracks }];
    try { localStorage.setItem(key, JSON.stringify(updated)); }
    catch { $('#playlistStatus').textContent = 'Não foi possível salvar. Verifique o espaço e as permissões do navegador.'; return; }
    playlists = updated; form.reset(); renderCollections();
    $('#playlistStatus').textContent = `Playlist “${name}” guardada.`;
  });
  function fromLocation(focus = true) {
    const [next = 'top', index] = location.hash.slice(1).split('/');
    show(next || 'top', {}, index === undefined && focus);
    if (index !== undefined && collectionRoutes.includes(route)) {
      const group = groups[Number(index)];
      if (group) show('musicas', { ids: group.ids, title: group.name }, focus);
    }
  }
  window.addEventListener('popstate', () => fromLocation());
  window.addEventListener('hashchange', () => fromLocation());
  MS.on('library:change', renderCollections);
  fromLocation(false);
})();
