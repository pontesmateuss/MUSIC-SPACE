const DATABASE = 'nest-library';
let database;
export function openDatabase() {
  if (database) return Promise.resolve(database);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('tracks', { keyPath: 'id' });
      db.createObjectStore('audio', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'id' });
    };
    request.onsuccess = () => { database = request.result; database.onversionchange = () => { database.close(); database = null; }; resolve(database); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Feche outras abas do NEST e tente novamente.'));
  });
}
async function transaction(stores, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Operação cancelada.'));
    result = operation(tx);
  });
}
export const loadTracks = () => transaction(['tracks'], 'readonly', tx => tx.objectStore('tracks').getAll());
export const loadAudio = id => transaction(['audio'], 'readonly', tx => tx.objectStore('audio').get(id));
export const saveTrack = (track, blob) => transaction(['tracks', 'audio'], 'readwrite', tx => {
  tx.objectStore('tracks').put(track);
  if (blob) tx.objectStore('audio').put({ id: track.id, blob });
});
export const removeTrack = (id, playlists) => transaction(['tracks', 'audio', 'settings'], 'readwrite', tx => {
  tx.objectStore('tracks').delete(id); tx.objectStore('audio').delete(id);
  tx.objectStore('settings').put({ id: 'playlists', value: playlists });
});
export const getSetting = async (id, fallback) => (await transaction(['settings'], 'readonly', tx => tx.objectStore('settings').get(id)))?.value ?? fallback;
export const setSetting = (id, value) => transaction(['settings'], 'readwrite', tx => tx.objectStore('settings').put({ id, value }));
