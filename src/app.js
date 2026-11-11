import { icon, hydrateIcons } from './icons.js';
import { loadTracks, loadAudio, saveTrack, removeTrack, getSetting, setSetting } from './storage.js';
import { parseMetadata, formatTime } from './metadata.js';
import { createDemo } from './demo.js';
import { MEDIA_ACCEPT, MEDIA_FORMAT_LABEL, isMediaFile } from './formats.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const state = { tracks:[], playlists:[], view:'home', tab:'songs', query:'', sort:'recent', collection:null, grid:false, current:null, queue:[], shuffle:false, repeat:0, importing:false, ready:false };
const views = [['home','home','Início'],['songs','library','Todas as músicas'],['albums','album','Álbuns'],['artists','artist','Artistas'],['favorites','heart','Favoritas']];
const audio = $('#audio');
$('#file-input').accept = MEDIA_ACCEPT;
const coverURLs = new Map();
let audioURL, loadToken = 0, toastTimer, installPrompt, previousVolume = .75, dragDepth = 0;
const palette = [['#334155','#1E293B'],['#164E63','#1E293B'],['#373B70','#28334D'],['#155E75','#164E63'],['#475569','#334155']];
function cover(track, extra = '') {
  if (!track) return `<span class="track-art ${extra}">${icon('music')}</span>`;
  let url = coverURLs.get(track.id);
  if (track.cover && !url) { url = URL.createObjectURL(track.cover); coverURLs.set(track.id, url); }
  const colors = palette[[...track.album + track.artist].reduce((sum, c) => sum + c.charCodeAt(0), 0) % palette.length];
  return `<span class="track-art ${extra}" style="--cover-a:${colors[0]};--cover-b:${colors[1]}">${url ? `<img src="${url}" alt="" loading="lazy">` : icon('music')}</span>`;
}
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500); }
function report(error) { console.error(error); toast(error?.name === 'QuotaExceededError' ? 'Espaço insuficiente no dispositivo. Libere espaço e tente novamente.' : 'Não foi possível concluir. Tente novamente; seus arquivos originais estão seguros.'); }
function persistPreferences() { setSetting('preferences', { volume:audio.volume, shuffle:state.shuffle, repeat:state.repeat, grid:state.grid }).catch(report); }
function currentTrack() { return state.tracks.find(t => t.id === state.current); }
function currentPlaylist() { return state.playlists.find(p => `playlist:${p.id}` === state.view); }
function filteredTracks() {
  let tracks = [...state.tracks];
  if (state.view === 'favorites' || (state.view === 'home' && state.tab === 'favorites')) tracks = tracks.filter(t => t.favorite);
  const playlist = currentPlaylist();
  if (playlist) tracks = tracks.filter(t => playlist.tracks.includes(t.id));
  if (state.collection) tracks = tracks.filter(t => state.collection.type === 'artist' ? t.artist === state.collection.name : t.album === state.collection.name && t.artist === state.collection.artist);
  const query = state.query.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (query) tracks = tracks.filter(t => `${t.title} ${t.artist} ${t.album}`.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(query));
  return tracks.sort((a,b) => state.sort === 'recent' ? b.addedAt - a.addedAt : a[state.sort].localeCompare(b[state.sort], 'pt-BR', { numeric:true }));
}
function renderNav() {
  $('#main-nav').innerHTML = views.map(([view, symbol, label]) => `<button class="nav-button ${state.view === view ? 'active' : ''}" data-view="${view}" ${state.view === view ? 'aria-current="page"' : ''}>${icon(symbol)}${label}${view === 'favorites' && state.tracks.some(t => t.favorite) ? `<span class="nav-count">${state.tracks.filter(t => t.favorite).length}</span>` : ''}</button>`).join('');
  $('#playlist-nav').innerHTML = state.playlists.map(p => `<button class="nav-button ${state.view === `playlist:${p.id}` ? 'active' : ''}" data-view="playlist:${p.id}">${icon('playlist')}<span class="track-name">${escape(p.name)}</span><span class="nav-count">${p.tracks.length}</span></button>`).join('');
  $('#playlist-hint').hidden = state.playlists.length > 0;
  document.querySelectorAll('.mobile-nav button').forEach(button => { button.classList.toggle('active', button.dataset.view === state.view || (button.dataset.view === 'songs' && ['albums','artists'].includes(state.view)) || (button.dataset.action === 'mobile-playlists' && state.view.startsWith('playlist:'))); });
}
function render() {
  renderNav();
  const home = state.view === 'home';
  $('#welcome').hidden = !home; $('#hero').hidden = !home;
  const title = currentPlaylist()?.name || views.find(v => v[0] === state.view)?.[2] || 'Sua biblioteca';
  $('#breadcrumb').textContent = title;
  $('#library-title').innerHTML = `${escape(home ? 'Sua biblioteca' : title)}<span id="track-count"></span>`;
  const tracks = filteredTracks();
  $('#track-count').textContent = tracks.length ? `${tracks.length} ${tracks.length === 1 ? 'música' : 'músicas'}` : '';
  $('#section-eyebrow').textContent = state.view === 'favorites' ? 'AS QUE MORAM AQUI' : currentPlaylist() ? 'UM SOM PARA CADA MOMENTO' : 'FEITA POR VOCÊ';
  $('#library-tabs').innerHTML = [['songs','Músicas'],['albums','Álbuns'],['artists','Artistas'],['favorites','Favoritas']].map(([tab,label]) => `<button class="tab" role="tab" aria-selected="${state.tab === tab}" data-tab="${tab}">${label}</button>`).join('');
  $('#library-tabs').hidden = !['home','songs','albums','artists'].includes(state.view);
  $('#layout-toggle').innerHTML = icon(state.grid ? 'list' : 'grid');
  $('#collection-header').innerHTML = state.collection ? `<div class="collection-banner"><div><button class="icon-button" data-action="back-collection" aria-label="Voltar">${icon('skip-back')}</button><strong>${escape(state.collection.name)}</strong></div><button class="button button-primary" data-action="play-all">${icon('play')} Reproduzir</button></div>` : currentPlaylist() ? `<div class="collection-banner"><button class="button button-primary" data-action="play-all" ${tracks.length ? '' : 'disabled'}>${icon('play')} Reproduzir</button><div><button class="text-button" data-action="rename-playlist">Renomear</button><button class="icon-button" data-action="delete-playlist" aria-label="Excluir playlist">${icon('trash')}</button></div></div>` : '';
  const library = $('#library');
  if (!tracks.length) {
    const emptyLibrary = !state.tracks.length;
    library.innerHTML = `<div class="empty-state"><div class="empty-symbol">${icon(emptyLibrary ? 'upload' : state.query ? 'search' : 'music')}</div><h3>${emptyLibrary ? 'Sua coleção começa com uma música.' : state.query ? 'Nenhuma música por aqui.' : state.view === 'favorites' || state.tab === 'favorites' ? 'Guarde aqui as suas preferidas.' : 'Esse espaço está esperando por música.'}</h3><p>${emptyLibrary ? 'Arraste seus arquivos para cá ou escolha no seu dispositivo.' : state.query ? 'Experimente buscar por outro nome, artista ou álbum.' : currentPlaylist() ? 'Use o menu ••• de uma música para adicionar a esta playlist.' : 'Toque no coração de uma música para encontrá-la aqui.'}</p><div class="empty-actions">${emptyLibrary ? '<button class="text-button" data-action="import">Escolher arquivos</button><span style="color:var(--muted)">·</span><button class="text-button" data-action="demo">Experimentar com um som</button>' : state.query ? '<button class="text-button" data-action="clear-search">Limpar busca</button>' : '<button class="text-button" data-view="songs">Explorar biblioteca</button>'}</div>${emptyLibrary ? '<p class="empty-formats">ÁUDIO E VÍDEO · MP3, M4A, MP4, WEBM E MAIS</p>' : ''}</div>`;
    return;
  }
  const groupMode = !state.collection && (state.tab === 'albums' || state.tab === 'artists') && !currentPlaylist() && state.view !== 'favorites';
  if (groupMode) {
    const artist = state.tab === 'artists';
    const groups = new Map();
    for (const track of tracks) { const key = artist ? track.artist : JSON.stringify([track.album, track.artist]); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(track); }
    library.innerHTML = `<div class="collection-grid">${[...groups.values()].map(group => `<button class="collection-card ${artist ? 'artist-card' : ''}" data-group="${group[0].id}" data-group-type="${artist ? 'artist' : 'album'}">${cover(group[0])}<strong>${escape(artist ? group[0].artist : group[0].album)}</strong><small>${artist ? `${group.length} ${group.length === 1 ? 'música' : 'músicas'}` : `${escape(group[0].artist)} · ${group.length} faixas`}</small></button>`).join('')}</div>`;
  } else if (state.grid) {
    library.innerHTML = `<div class="collection-grid">${tracks.map(t => `<div><button class="collection-card" style="width:100%" data-track="${t.id}" aria-label="Reproduzir ${escape(t.title)}">${cover(t)}<strong>${escape(t.title)}</strong><small>${escape(t.artist)}</small></button><div class="row-actions">${trackActions(t)}</div></div>`).join('')}</div>`;
  } else {
    library.innerHTML = `<table class="track-table"><thead><tr><th>#</th><th>TÍTULO</th><th>ÁLBUM</th><th>TEMPO</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>${tracks.map((t,i) => `<tr class="track-row ${t.id === state.current ? 'is-current' : ''}" data-track="${t.id}"><td><button class="index-play" aria-label="Reproduzir ${escape(t.title)}">${t.id === state.current ? icon(audio.paused ? 'play' : 'volume') : i + 1}</button></td><td><div class="track-main">${cover(t)}<div class="track-text"><strong class="track-name">${escape(t.title)}</strong><span class="track-artist">${escape(t.artist)}</span></div></div></td><td class="track-album">${escape(t.album)}</td><td>${t.duration ? formatTime(t.duration) : '—'}</td><td><div class="row-actions">${trackActions(t)}</div></td></tr>`).join('')}</tbody></table>`;
  }
}
function trackActions(track) { return `<button class="icon-button ${track.favorite ? 'favorited' : ''}" data-favorite="${track.id}" aria-label="${track.favorite ? 'Remover dos favoritos' : 'Favoritar'}" aria-pressed="${!!track.favorite}">${icon('heart')}</button><button class="icon-button" data-menu="${track.id}" aria-label="Opções de ${escape(track.title)}">${icon('more')}</button>`; }
function navigate(view) { state.view = view; state.collection = null; state.query = ''; $('#search').value = ''; state.tab = ['albums','artists'].includes(view) ? view : 'songs'; render(); $('#library').classList.remove('view-enter'); requestAnimationFrame(() => $('#library').classList.add('view-enter')); window.scrollTo({ top:0, behavior:'smooth' }); }
function updatePlayer() {
  const track = currentTrack();
  $('#now-title').textContent = track?.title || 'Seu próximo som favorito'; $('#now-artist').textContent = track?.artist || 'Começa com um play';
  $('#now-art').innerHTML = track ? cover(track) : icon('music');
  $('#now-art .track-art')?.style.setProperty('width','100%'); $('#now-art .track-art')?.style.setProperty('height','100%');
  $('#now-favorite').disabled = !track; $('#now-favorite').classList.toggle('favorited', !!track?.favorite); $('#now-favorite').setAttribute('aria-pressed', String(!!track?.favorite));
  $('#now-favorite').setAttribute('aria-label', track?.favorite ? 'Remover dos favoritos' : 'Favoritar música');
  $('#play').disabled = !state.tracks.length;
  $('#previous').disabled = !track; $('#next').disabled = !track;
  $('#seek').disabled = !track || !Number.isFinite(audio.duration);
  $('#player').classList.toggle('playing', !audio.paused); $('#play').setAttribute('aria-label', audio.paused ? 'Reproduzir' : 'Pausar');
  $('#shuffle').classList.toggle('active', state.shuffle); $('#shuffle').setAttribute('aria-pressed', String(state.shuffle));
  $('#repeat').classList.toggle('active', state.repeat > 0); $('#repeat').setAttribute('aria-pressed', String(state.repeat > 0)); $('#repeat').setAttribute('aria-label', ['Repetição desativada','Repetir fila','Repetir música'][state.repeat]); $('#repeat-one').hidden = state.repeat !== 2;
  $('#mute').innerHTML = icon(audio.muted || audio.volume === 0 ? 'muted' : 'volume'); $('#mute').setAttribute('aria-label', audio.muted ? 'Ativar som' : 'Silenciar');
  $('#volume').value = audio.muted ? 0 : audio.volume; $('#volume').style.setProperty('--progress', `${(audio.muted ? 0 : audio.volume) * 100}%`);
  updateProgress();
}
function updateProgress() {
  const duration = Number.isFinite(audio.duration) ? audio.duration : currentTrack()?.duration || 0;
  $('#elapsed').textContent = formatTime(audio.currentTime); $('#duration').textContent = formatTime(duration);
  $('#seek').value = duration ? audio.currentTime / duration * 100 : 0; $('#seek').style.setProperty('--progress', `${$('#seek').value}%`);
  if ('mediaSession' in navigator && Number.isFinite(audio.duration) && audio.duration > 0) {
    try { navigator.mediaSession.setPositionState({ duration:audio.duration, position:Math.min(audio.currentTime, audio.duration), playbackRate:audio.playbackRate }); } catch { /* Unsupported browser capability. */ }
  }
}
async function playTrack(id, queue) {
  if (id === state.current && audio.src) { await togglePlay(); return; }
  const token = ++loadToken;
  try {
    const stored = await loadAudio(id);
    if (token !== loadToken) return;
    if (!stored) { toast('Arquivo não encontrado neste dispositivo. Importe a música novamente.'); return; }
    audio.pause(); audio.removeAttribute('src'); audio.load();
    if (audioURL) URL.revokeObjectURL(audioURL);
    audioURL = URL.createObjectURL(stored.blob); state.current = id;
    if (queue) state.queue = [...queue];
    if (!state.queue.includes(id)) state.queue = state.tracks.map(t => t.id);
    audio.src = audioURL; audio.load(); updatePlayer(); render();
    const track = currentTrack();
    if ('mediaSession' in navigator && 'MediaMetadata' in window) navigator.mediaSession.metadata = new MediaMetadata({ title:track.title, artist:track.artist, album:track.album, artwork:track.cover ? [{ src:coverURLs.get(id), type:track.cover.type }] : [{ src:new URL('../assets/icon-512.png', import.meta.url).href, sizes:'512x512', type:'image/png' }] });
    await audio.play();
  } catch (error) { if (token === loadToken) { toast(error.name === 'NotAllowedError' ? 'Toque em play para começar a ouvir.' : 'Não foi possível tocar este arquivo. O formato ou codec pode não ser compatível com este navegador.'); updatePlayer(); } }
}
async function togglePlay() {
  if (!state.current) { const tracks = filteredTracks(); if (tracks[0]) await playTrack(tracks[0].id, tracks.map(t => t.id)); return; }
  if (audio.paused) { try { await audio.play(); } catch { toast('Não foi possível reproduzir. Verifique o formato do arquivo ou tente outra música.'); } } else audio.pause();
}
function nextTrack(direction = 1, ended = false) {
  const queue = state.queue.filter(id => state.tracks.some(t => t.id === id)); if (!queue.length) return;
  if (direction === -1 && audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (ended && state.repeat === 2) { audio.currentTime = 0; audio.play().catch(report); return; }
  const currentIndex = queue.indexOf(state.current);
  let index = currentIndex + direction;
  if (state.shuffle && direction === 1 && queue.length > 1) { const candidates = queue.filter(id => id !== state.current); index = queue.indexOf(candidates[Math.floor(Math.random() * candidates.length)]); }
  if (index >= queue.length && ended && state.repeat === 0) { updatePlayer(); return; }
  index = (index + queue.length) % queue.length;
  if (queue[index] === state.current) { audio.currentTime = 0; audio.play().catch(report); } else playTrack(queue[index], queue);
}
async function favorite(id) { const track = state.tracks.find(t => t.id === id); if (!track) return; const updated = { ...track, favorite:!track.favorite }; await saveTrack(updated); Object.assign(track, updated); render(); updatePlayer(); }
async function measureDuration(file) {
  return new Promise(resolve => {
    const probe = new Audio(), url = URL.createObjectURL(file); let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(timeout); const duration = Number.isFinite(probe.duration) ? probe.duration : 0; probe.removeAttribute('src'); probe.load(); URL.revokeObjectURL(url); resolve(duration); };
    const timeout = setTimeout(finish, 4000); probe.preload = 'metadata'; probe.onloadedmetadata = finish; probe.onerror = finish; probe.src = url;
  });
}
async function importFiles(files, demo = false) {
  if (!state.ready) { toast('A biblioteca ainda não está disponível. Recarregue a página.'); return; }
  if (state.importing) { toast('Aguarde a importação atual terminar.'); return; }
  const all = [...files], valid = all.filter(isMediaFile);
  if (!valid.length) { toast(`Selecione arquivos de áudio ou vídeo: ${MEDIA_FORMAT_LABEL}.`); return; }
  state.importing = true;
  let imported = 0, duplicates = 0, failed = all.length - valid.length;
  let first;
  try {
    for (let index = 0; index < valid.length; index++) {
      const file = valid[index]; toast(`Guardando suas músicas… ${index + 1} de ${valid.length}`);
      // Full SHA-256 prevents accidental deduplication of distinct files sharing a name.
      try {
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        const id = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
        if (state.tracks.some(t => t.id === id)) { duplicates++; first ||= id; continue; }
        const metadata = await parseMetadata(file);
        if (!metadata.duration) metadata.duration = await measureDuration(file);
        const track = { ...metadata, id, filename:file.name, size:file.size, addedAt:Date.now() + index, favorite:false, format:file.name.split('.').pop().toUpperCase() };
        if (demo) track.album = 'Sons de casa';
        await saveTrack(track, file); state.tracks.push(track); first ||= id; imported++;
      } catch (error) { failed++; console.error(error); if (error.name === 'QuotaExceededError') { toast('O dispositivo ficou sem espaço. As músicas já importadas foram preservadas.'); break; } }
    }
    state.query = ''; $('#search').value = ''; render(); updatePlayer();
    toast(`${imported} ${imported === 1 ? 'música adicionada' : 'músicas adicionadas'}${duplicates ? ` · ${duplicates} já na biblioteca` : ''}${failed ? ` · ${failed} não importadas (formato, leitura ou espaço)` : ''}.`);
    if (demo && first) await playTrack(first, state.tracks.map(t => t.id));
  } finally { state.importing = false; $('#file-input').value = ''; }
}
function showDialog(title, content) { $('#dialog-title').textContent = title; $('#dialog-content').innerHTML = content; if (!$('#dialog').open) $('#dialog').showModal(); }
function closeDialog() { $('#dialog').close(); }
function playlistForm(rename = false) {
  const playlist = currentPlaylist();
  showDialog(rename ? 'Um novo nome' : 'Um lugar para cada momento', `<form id="playlist-form"><label for="playlist-name">Nome da playlist</label><input id="playlist-name" type="text" placeholder="Ex.: Manhãs tranquilas" maxlength="60" value="${rename ? escape(playlist.name) : ''}" required autocomplete="off"><p>Uma trilha para trabalhar, descansar ou simplesmente estar.</p><div class="dialog-actions"><button type="button" class="button button-ghost" data-action="close-dialog">Cancelar</button><button class="button button-primary" type="submit">${rename ? 'Salvar nome' : 'Criar playlist'}</button></div></form>`);
  $('#playlist-form').addEventListener('submit', async event => { event.preventDefault(); const name = $('#playlist-name').value.trim(); if (!name) return; const updated = rename ? state.playlists.map(p => p.id === playlist.id ? { ...p, name } : p) : [...state.playlists, { id:crypto.randomUUID(), name, tracks:[] }]; try { await setSetting('playlists', updated); state.playlists = updated; closeDialog(); navigate(`playlist:${rename ? playlist.id : updated.at(-1).id}`); toast(rename ? 'Nome atualizado.' : 'Playlist criada. Adicione músicas pelo menu •••.'); } catch (error) { report(error); } });
  $('#playlist-name').focus();
}
function trackMenu(id) {
  const track = state.tracks.find(t => t.id === id); if (!track) return;
  showDialog(track.title, `<p>${escape(track.artist)} · ${escape(track.format)} · ${(track.size / 1048576).toFixed(1)} MB</p><button class="dialog-option" data-add-to-playlist="${id}">${icon('playlist')} Adicionar à playlist</button>${currentPlaylist() ? `<button class="dialog-option" data-remove-from-playlist="${id}">${icon('close')} Remover desta playlist</button>` : ''}<button class="dialog-option" data-edit-track="${id}">${icon('music')} Editar informações</button><button class="dialog-option" data-download-track="${id}">${icon('download')} Baixar arquivo original</button><button class="dialog-option danger" data-delete-track="${id}">${icon('trash')} Remover da biblioteca</button>`);
}
function editTrack(id) {
  const track = state.tracks.find(t => t.id === id);
  showDialog('Informações da música', `<form id="edit-form">${[['title','Título'],['artist','Artista'],['album','Álbum']].map(([key,label]) => `<label for="edit-${key}">${label}<input id="edit-${key}" type="text" value="${escape(track[key])}" maxlength="200" required></label>`).join('')}<p>As alterações ficam na biblioteca. O arquivo original é preservado.</p><div class="dialog-actions"><button class="button button-primary" type="submit">Salvar informações</button></div></form>`);
  $('#edit-form').addEventListener('submit', async event => { event.preventDefault(); const updated = { ...track }; for (const key of ['title','artist','album']) { updated[key] = $(`#edit-${key}`).value.trim(); if (!updated[key]) return; } try { await saveTrack(updated); Object.assign(track, updated); closeDialog(); state.collection = null; render(); updatePlayer(); if (track.id === state.current && navigator.mediaSession?.metadata) { navigator.mediaSession.metadata.title = track.title; navigator.mediaSession.metadata.artist = track.artist; navigator.mediaSession.metadata.album = track.album; } toast('Informações salvas.'); } catch (error) { report(error); } });
}
function choosePlaylist(id) {
  showDialog('Adicionar à playlist', state.playlists.length ? state.playlists.map(p => `<button class="dialog-option" data-target-playlist="${p.id}" data-song-id="${id}">${icon(p.tracks.includes(id) ? 'check' : 'playlist')} ${escape(p.name)}${p.tracks.includes(id) ? ' · já adicionada' : ''}</button>`).join('') : '<p>Crie sua primeira playlist e depois adicione esta música pelo menu •••.</p><button class="button button-primary" data-action="new-playlist">Criar playlist</button>');
}
async function downloadTrack(id) { const stored = await loadAudio(id), track = state.tracks.find(t => t.id === id); if (!stored || !track) return; const url = URL.createObjectURL(stored.blob), a = document.createElement('a'); a.href = url; a.download = track.filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); closeDialog(); }
function confirmDeleteTrack(id) {
  const track = state.tracks.find(t => t.id === id);
  showDialog('Remover música?', `<p>“${escape(track.title)}” será removida do Music Space e das playlists. O arquivo original no seu dispositivo não será alterado.</p><div class="dialog-actions"><button class="button button-ghost" data-action="close-dialog">Cancelar</button><button class="button button-danger" data-confirm-delete="${id}">Remover música</button></div>`);
}
async function deleteTrack(id) {
  const playlists = state.playlists.map(p => ({ ...p, tracks:p.tracks.filter(t => t !== id) }));
  await removeTrack(id, playlists);
  if (state.current === id) { ++loadToken; audio.pause(); audio.removeAttribute('src'); audio.load(); if (audioURL) URL.revokeObjectURL(audioURL); audioURL = null; state.current = null; if ('mediaSession' in navigator) navigator.mediaSession.metadata = null; }
  state.tracks = state.tracks.filter(t => t.id !== id); state.queue = state.queue.filter(t => t !== id); state.playlists = playlists;
  if (coverURLs.has(id)) { URL.revokeObjectURL(coverURLs.get(id)); coverURLs.delete(id); }
  closeDialog(); render(); updatePlayer(); toast('Música removida da biblioteca.');
}
function queueDialog() { showDialog('A seguir', state.queue.length ? state.queue.map(id => state.tracks.find(t => t.id === id)).filter(Boolean).map(t => `<button class="queue-item ${t.id === state.current ? 'active' : ''}" data-queue-track="${t.id}">${cover(t)}<span class="track-text"><strong class="track-name">${escape(t.title)}</strong><span class="track-artist">${escape(t.artist)}</span></span></button>`).join('') : '<p>Dê play em uma música para começar sua fila.</p>'); }
async function settingsDialog() {
  const bytes = state.tracks.reduce((sum,t) => sum + t.size + (t.cover?.size || 0), 0);
  showDialog('Seu Music Space, do seu jeito', `<div class="setting-card"><h3>${icon('download')} Instale e sinta-se em casa</h3><p>Use o Music Space como aplicativo no celular ou computador. Depois do primeiro carregamento completo, sua biblioteca funciona offline.</p>${installPrompt ? '<button class="button button-primary" data-action="install">Instalar Music Space</button>' : '<p>No Chrome/Edge, use “Instalar aplicativo” no menu do navegador. No iPhone/iPad, abra no Safari e toque em Compartilhar → Adicionar à Tela de Início.</p>'}</div><div class="setting-card"><h3>Sua música fica neste dispositivo</h3><p>${state.tracks.length} músicas · ${(bytes / 1048576).toFixed(1)} MB de arquivos locais. Nenhum áudio é enviado para servidores.</p><p>Limpar os dados do navegador remove a biblioteca. Guarde os arquivos originais; cada navegador e dispositivo tem sua própria coleção.</p><button class="button button-ghost" data-action="persist-storage">Proteger armazenamento local</button></div><div class="setting-card"><h3>Pequenos atalhos</h3><p>Espaço: play/pausa · ← / →: voltar ou avançar 5 segundos · /: buscar · Esc: fechar player expandido.</p><p>${MEDIA_FORMAT_LABEL}. Nos vídeos, o Music Space reproduz o áudio. A reprodução depende dos codecs disponíveis no dispositivo.</p></div><p style="text-align:center">Music Space 1.0 · Sem anúncios. Sem assinaturas. Só música.</p>`);
}
async function action(name) {
  if (name === 'import') $('#file-input').click();
  else if (name === 'demo') await importFiles([createDemo()], true);
  else if (name === 'play') await togglePlay();
  else if (name === 'next') nextTrack(1);
  else if (name === 'previous') nextTrack(-1);
  else if (name === 'favorite-current') await favorite(state.current);
  else if (name === 'shuffle') { state.shuffle = !state.shuffle; updatePlayer(); persistPreferences(); toast(state.shuffle ? 'Reprodução aleatória ativada.' : 'Reprodução em ordem.'); }
  else if (name === 'repeat') { state.repeat = (state.repeat + 1) % 3; updatePlayer(); persistPreferences(); toast(['Repetição desativada.','A fila será repetida.','Esta música será repetida.'][state.repeat]); }
  else if (name === 'mute') { if (audio.volume === 0) { audio.volume = previousVolume || .75; audio.muted = false; } else audio.muted = !audio.muted; updatePlayer(); }
  else if (name === 'expand') { const expanded = $('#player').classList.toggle('expanded'); document.body.style.overflow = expanded ? 'hidden' : ''; if (expanded) $('.player-collapse').focus(); }
  else if (name === 'layout') { state.grid = !state.grid; persistPreferences(); render(); }
  else if (name === 'back-collection') { state.collection = null; render(); }
  else if (name === 'clear-search') { state.query = ''; $('#search').value = ''; render(); }
  else if (name === 'play-all') { const tracks = filteredTracks(); if (tracks[0]) await playTrack(tracks[0].id, tracks.map(t => t.id)); }
  else if (name === 'new-playlist') playlistForm();
  else if (name === 'rename-playlist') playlistForm(true);
  else if (name === 'delete-playlist') showDialog('Excluir playlist?', `<p>A playlist “${escape(currentPlaylist().name)}” será excluída. Suas músicas continuam na biblioteca.</p><div class="dialog-actions"><button class="button button-ghost" data-action="close-dialog">Cancelar</button><button class="button button-danger" data-action="confirm-delete-playlist">Excluir playlist</button></div>`);
  else if (name === 'confirm-delete-playlist') { const updated = state.playlists.filter(p => p.id !== currentPlaylist().id); await setSetting('playlists', updated); state.playlists = updated; closeDialog(); navigate('songs'); }
  else if (name === 'close-dialog') closeDialog();
  else if (name === 'settings') await settingsDialog();
  else if (name === 'queue') queueDialog();
  else if (name === 'mobile-playlists') showDialog('Suas playlists', state.playlists.map(p => `<button class="dialog-option" data-view="playlist:${p.id}">${icon('playlist')} ${escape(p.name)} · ${p.tracks.length}</button>`).join('') + '<button class="dialog-option" data-action="new-playlist">' + icon('plus') + ' Criar playlist</button>');
  else if (name === 'persist-storage') { const granted = await navigator.storage?.persist?.(); toast(granted ? 'Armazenamento persistente ativado neste navegador.' : 'O navegador não concedeu persistência. Mantenha uma cópia dos arquivos originais.'); }
  else if (name === 'install' && installPrompt) { await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; await settingsDialog(); }
}
document.addEventListener('click', async event => {
  const el = event.target.closest('button, [data-track], [data-group]'); if (!el) return;
  try {
    if (el.dataset.action) await action(el.dataset.action);
    else if (el.dataset.view) { closeDialog(); navigate(el.dataset.view); }
    else if (el.dataset.tab) { state.tab = el.dataset.tab; state.collection = null; if (state.view !== 'home') state.view = el.dataset.tab === 'favorites' ? 'favorites' : el.dataset.tab; render(); }
    else if (el.dataset.favorite) await favorite(el.dataset.favorite);
    else if (el.dataset.menu) trackMenu(el.dataset.menu);
    else if (el.dataset.group) { const track = state.tracks.find(t => t.id === el.dataset.group); state.collection = { type:el.dataset.groupType, name:el.dataset.groupType === 'artist' ? track.artist : track.album, artist:track.artist }; render(); }
    else if (el.dataset.addToPlaylist) choosePlaylist(el.dataset.addToPlaylist);
    else if (el.dataset.targetPlaylist) { const updated = state.playlists.map(p => p.id === el.dataset.targetPlaylist && !p.tracks.includes(el.dataset.songId) ? { ...p, tracks:[...p.tracks, el.dataset.songId] } : p); await setSetting('playlists', updated); state.playlists = updated; closeDialog(); render(); toast('Música na playlist.'); }
    else if (el.dataset.removeFromPlaylist) { const updated = state.playlists.map(p => p.id === currentPlaylist().id ? { ...p, tracks:p.tracks.filter(id => id !== el.dataset.removeFromPlaylist) } : p); await setSetting('playlists', updated); state.playlists = updated; closeDialog(); render(); }
    else if (el.dataset.editTrack) editTrack(el.dataset.editTrack);
    else if (el.dataset.downloadTrack) await downloadTrack(el.dataset.downloadTrack);
    else if (el.dataset.deleteTrack) confirmDeleteTrack(el.dataset.deleteTrack);
    else if (el.dataset.confirmDelete) await deleteTrack(el.dataset.confirmDelete);
    else if (el.dataset.queueTrack) { closeDialog(); await playTrack(el.dataset.queueTrack, state.queue); }
    else { const row = el.closest('[data-track]'); if (row) await playTrack(row.dataset.track, filteredTracks().map(t => t.id)); }
  } catch (error) { report(error); }
});
$('#file-input').addEventListener('change', event => importFiles(event.target.files).catch(report));
$('#search').addEventListener('input', event => { state.query = event.target.value; render(); });
$('#sort').addEventListener('change', event => { state.sort = event.target.value; render(); });
$('#volume').addEventListener('input', event => { audio.volume = Number(event.target.value); audio.muted = false; if (audio.volume) previousVolume = audio.volume; updatePlayer(); });
$('#volume').addEventListener('change', persistPreferences);
$('#seek').addEventListener('input', event => { if (Number.isFinite(audio.duration)) { audio.currentTime = audio.duration * Number(event.target.value) / 100; updateProgress(); } });
audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('loadedmetadata', () => { const track = currentTrack(); if (track && Number.isFinite(audio.duration)) { track.duration = audio.duration; saveTrack(track).catch(report); } updatePlayer(); });
for (const name of ['play','pause','ended']) audio.addEventListener(name, () => { updatePlayer(); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing'; document.querySelectorAll('.track-row').forEach(row => { row.classList.toggle('is-current', row.dataset.track === state.current); if (row.dataset.track === state.current) row.querySelector('.index-play').innerHTML = icon(audio.paused ? 'play' : 'volume'); }); });
audio.addEventListener('ended', () => nextTrack(1, true));
audio.addEventListener('error', () => { if (audio.getAttribute('src')) toast('Este áudio não pôde ser lido. Tente outro arquivo ou navegador compatível com o codec.'); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('#player').classList.contains('expanded')) { $('#player').classList.remove('expanded'); document.body.style.overflow = ''; }
  if (event.target.matches('input,textarea,select,button') || event.target.isContentEditable || document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
  if (event.key === '/') { event.preventDefault(); $('#search').focus(); }
  if (['ArrowLeft','ArrowRight'].includes(event.key) && Number.isFinite(audio.duration)) { event.preventDefault(); audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + (event.key === 'ArrowRight' ? 5 : -5))); }
});
document.addEventListener('dragenter', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); dragDepth++; $('#drop-overlay').hidden = false; } });
document.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
document.addEventListener('dragleave', event => { if (event.dataTransfer?.types.includes('Files')) { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#drop-overlay').hidden = true; } });
document.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; $('#drop-overlay').hidden = true; if (event.dataTransfer?.files.length) importFiles(event.dataTransfer.files).catch(report); });
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
window.addEventListener('appinstalled', () => { installPrompt = null; toast('Music Space instalado. Sinta-se em casa.'); });
if ('mediaSession' in navigator) {
  for (const [name, handler] of Object.entries({ play:() => audio.play().catch(report), pause:() => audio.pause(), previoustrack:() => nextTrack(-1), nexttrack:() => nextTrack(1), seekto:details => { if (Number.isFinite(details.seekTime) && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(audio.duration, details.seekTime)); }, seekbackward:details => { audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10)); }, seekforward:details => { if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, audio.currentTime + (details.seekOffset || 10)); } })) { try { navigator.mediaSession.setActionHandler(name, handler); } catch { /* Optional OS integration. */ } }
}
hydrateIcons(); render();
async function init() {
  try {
    const [tracks, playlists, preferences] = await Promise.all([loadTracks(), getSetting('playlists', []), getSetting('preferences', {})]);
    state.tracks = tracks; state.playlists = playlists; state.shuffle = !!preferences.shuffle; state.repeat = preferences.repeat || 0; state.grid = !!preferences.grid; audio.volume = preferences.volume ?? .75; previousVolume = audio.volume || .75; state.ready = true;
    render(); updatePlayer();
  } catch (error) { console.error(error); showDialog('Precisamos do armazenamento local', '<p>O Music Space não conseguiu abrir a biblioteca neste navegador. Verifique se o armazenamento do site está permitido e tente recarregar. Em navegação privada, os dados podem não ser preservados.</p><button class="button button-primary" onclick="location.reload()">Tentar novamente</button>'); }
  if ('serviceWorker' in navigator && window.isSecureContext) {
    try { const registration = await navigator.serviceWorker.register('./sw.js'); await navigator.serviceWorker.ready; const showOffline = () => { $('#offline-status').innerHTML = '<span class="status-dot"></span> Pronto para ouvir offline'; }; if (registration.active) showOffline(); else navigator.serviceWorker.addEventListener('controllerchange', showOffline, { once:true }); }
    catch (error) { console.warn('Offline unavailable', error); $('#offline-status').textContent = 'Offline ainda indisponível'; }
  }
}
init();
