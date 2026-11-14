/* Pure library operations shared by the interface and regression tests. */
(function () {
  const model = {
    distribute(songs, count = 5) {
      const rings = Array.from({ length: count }, () => []);
      // Spread small collections across the entire radius, then fill evenly.
      songs.forEach((song, i) => {
        const ring = songs.length < count && songs.length > 1
          ? Math.round(i * (count - 1) / (songs.length - 1)) : i % count;
        rings[ring].push(song);
      });
      return rings;
    },
    tracks(playlist, get) { return playlist.tracks.map(get).filter(Boolean); },
    add(playlist, id) { return { ...playlist, tracks: [...new Set([...playlist.tracks, id])] }; },
    remove(playlist, id) { return { ...playlist, tracks: playlist.tracks.filter(track => track !== id) }; },
    move(playlist, id, direction) {
      const tracks = [...playlist.tracks], from = tracks.indexOf(id), to = from + direction;
      if (from >= 0 && to >= 0 && to < tracks.length) [tracks[from], tracks[to]] = [tracks[to], tracks[from]];
      return { ...playlist, tracks };
    },
  };
  window.MS.libraryModel = model;
})();
