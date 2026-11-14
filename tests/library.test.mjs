import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const context = vm.createContext({ window: { MS: {} } });
vm.runInContext(readFileSync(new URL('../js/library-model.js', import.meta.url), 'utf8'), context);
const model = context.window.MS.libraryModel;
const plain = value => JSON.parse(JSON.stringify(value));
test('same-mood imports fill every orbit evenly without losing songs', () => {
  for (const count of [0, 1, 2, 3, 4, 5, 6, 17, 101]) {
    const songs = Array.from({ length: count }, (_, i) => ({ id: String(i), mood: 'noturno' }));
    const rings = plain(model.distribute(songs));
    assert.equal(rings.flat().length, count);
    assert.equal(new Set(rings.flat().map(s => s.id)).size, count);
    const sizes = rings.map(r => r.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
    if (count > 1) { assert.ok(rings[0].length); assert.ok(rings[4].length); }
  }
});
test('playlist membership is unique and edits do not mutate saved state', () => {
  const p = { id: 'p', name: 'Minha playlist', tracks: ['a', 'b'] };
  assert.deepEqual(plain(model.add(p, 'a')).tracks, ['a', 'b']);
  assert.deepEqual(plain(model.add(p, 'c')).tracks, ['a', 'b', 'c']);
  assert.deepEqual(plain(model.remove(p, 'a')).tracks, ['b']);
  assert.deepEqual(p.tracks, ['a', 'b']);
});
test('playlist queue follows custom order and ignores missing library songs', () => {
  const p = { tracks: ['a', 'deleted', 'b'] };
  const songs = { a: { id: 'a' }, b: { id: 'b' } };
  assert.deepEqual(plain(model.tracks(p, id => songs[id])), [songs.a, songs.b]);
  const moved = model.move({ tracks: ['a', 'b', 'c'] }, 'c', -1);
  assert.deepEqual(plain(moved).tracks, ['a', 'c', 'b']);
  assert.deepEqual(plain(model.move(moved, 'a', -1)).tracks, ['a', 'c', 'b']);
  assert.deepEqual(plain(model.move(moved, 'b', 1)).tracks, ['a', 'c', 'b']);
});
