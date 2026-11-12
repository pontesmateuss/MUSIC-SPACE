import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../js/import.js', import.meta.url), 'utf8');
function setup(failName) {
  const songs = new Map(), blobs = new Map();
  let id = 0;
  const MS = { util: { hash: value => value.length }, store: {
    add(data) { const song = { ...data, id: ++id }; songs.set(id, song); return song; },
    async putBlob(id, file) { if (file.name === failName) throw new Error('Storage full'); blobs.set(id, file); },
    remove(id) { songs.delete(id); },
  } };
  vm.runInNewContext(source, { window: { MS } });
  return { api: MS.importFiles, songs, blobs };
}
const file = name => ({ name, size: 100, lastModified: 42 });
test('selection accumulates batches, skips duplicates and rejects non-media', () => {
  const { api } = setup();
  const first = api.select([], [file('one.mp3'), file('two.MP4')]);
  const next = api.select(first.files, [file('one.mp3'), file('three.flac'), file('cover.jpg')]);
  assert.equal(next.files.length, 3);
  assert.equal(next.rejected, 1);
});
test('batch saves every distinct file with its own title and blob', async () => {
  const { api, songs, blobs } = setup();
  const files = [file('One.mp3'), file('Two.m4a'), file('Three.mp4')];
  const progress = [];
  const result = await api.save(files, { title: 'Must not repeat', mood: 'calma' }, n => progress.push(n));
  assert.deepEqual([...songs.values()].map(s => s.title), ['One', 'Two', 'Three']);
  assert.deepEqual([...blobs.values()], files);
  assert.equal(result.saved.length, 3);
  assert.deepEqual(progress, [1, 2, 3]);
});
test('failed storage retains failed files for retry without phantom songs', async () => {
  const { api, songs } = setup('bad.mp3');
  const result = await api.save([file('ok.wav'), file('bad.mp3'), file('last.ogg')], {});
  assert.equal(result.saved.length, 2);
  assert.equal(result.failed[0].name, 'bad.mp3');
  assert.equal(songs.size, 2);
});
test('single file preserves an edited title', async () => {
  const { api } = setup();
  const result = await api.save([file('file.mp3')], { title: 'Meu título' });
  assert.equal(result.saved[0].title, 'Meu título');
});
