/* Shared batch import logic for the picker and drag-and-drop. */
(function () {
  const MS = window.MS;
  const supported = /\.(mp3|wav|ogg|m4a|aac|flac|opus|mp4|m4v|webm|mov|mkv)$/i;
  const title = file => file.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim();
  function select(current, incoming) {
    const files = [...current];
    let rejected = 0;
    for (const file of incoming) {
      if (!supported.test(file.name)) { rejected++; continue; }
      if (!files.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) files.push(file);
    }
    return { files, rejected };
  }
  async function save(files, details, progress) {
    const saved = [], failed = [];
    for (const [index, file] of files.entries()) {
      const name = files.length === 1 ? details.title || title(file) : title(file);
      const song = MS.store.add({ ...details, title: name, seed: MS.util.hash(name + '|' + index), hasFile: true, fileName: file.name, dur: 0 });
      try {
        await MS.store.putBlob(song.id, file);
        saved.push(song);
      } catch (error) {
        MS.store.remove(song.id);
        failed.push(file);
      }
      if (progress) progress(index + 1, files.length);
    }
    return { saved, failed };
  }
  MS.importFiles = { select, save, title };
})();
