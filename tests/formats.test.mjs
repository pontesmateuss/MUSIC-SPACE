import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isMediaFile, MEDIA_ACCEPT } from '../src/formats.js';
import { parseMetadata } from '../src/metadata.js';

test('Windows files without MIME types accept audio and video, rejecting unrelated files', () => {
  for (const name of ['Song.MP4', 'Song.mkv', 'Song.webm', 'Song.m4a', 'Song.MP3', 'Song.flac', 'Song.wav']) {
    assert.equal(isMediaFile(new File([], name)), true);
  }
  for (const name of ['cover.jpg', 'playlist.txt', 'song.mp4.exe', 'mp4']) {
    assert.equal(isMediaFile(new File([], name)), false);
  }
});

test('picker extensions agree with the import filter', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(html.match(/id="file-input"[^>]*accept="([^"]+)"/)[1], MEDIA_ACCEPT);
});

test('new media formats retain metadata fallback without the file extension', async () => {
  for (const extension of ['MP4', 'm4a', 'webm', 'mkv']) {
    const result = await parseMetadata(new File([], `Artist - Song.${extension}`));
    assert.equal(result.title, 'Song');
    assert.equal(result.artist, 'Artist');
  }
});
