import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata, fallbackMetadata, formatTime } from '../src/metadata.js';
import { createDemo } from '../src/demo.js';
const file = (bytes,name='test.mp3') => new File([bytes],name);
test('filename fallback and time formatting handle unknown and long tracks', () => {
  assert.deepEqual(fallbackMetadata('Banda - Uma - Música.FLAC'), { title:'Uma - Música', artist:'Banda', album:'Sem álbum', duration:0 });
  assert.equal(fallbackMetadata('Título.wav').artist,'Artista desconhecido');
  assert.equal(formatTime(NaN),'0:00'); assert.equal(formatTime(Infinity),'0:00'); assert.equal(formatTime(-1),'0:00'); assert.equal(formatTime(3661.9),'61:01');
});
test('ID3v2.3 UTF-8 fields and embedded artwork', async () => {
  const frame = (key,body) => { const head=Buffer.alloc(10);head.write(key);head.writeUInt32BE(body.length,4);return Buffer.concat([head,body]); };
  const body=Buffer.concat([frame('TIT2',Buffer.concat([Buffer.from([3]),Buffer.from('Canção de casa')])),frame('TPE1',Buffer.from('\x03NEST Studio')),frame('TALB',Buffer.from('\x03Sons de casa')),frame('APIC',Buffer.from([0,...Buffer.from('image/png'),0,3,0,137,80,78,71]))]);
  const head=Buffer.from([73,68,51,3,0,0,0,0,body.length>>7,body.length&127]);
  const result=await parseMetadata(file(Buffer.concat([head,body])));
  assert.equal(result.title,'Canção de casa');assert.equal(result.artist,'NEST Studio');assert.equal(result.album,'Sons de casa');assert.equal(result.cover.type,'image/png');assert.equal(result.cover.size,4);
});
test('ID3v1 fallback reads legacy MP3 tags', async () => {
  const tail=Buffer.alloc(128);tail.write('TAG');tail.write('Legacy title',3);tail.write('Legacy artist',33);tail.write('Legacy album',63);
  const result=await parseMetadata(file(tail));assert.equal(result.title,'Legacy title');assert.equal(result.artist,'Legacy artist');assert.equal(result.album,'Legacy album');
});
test('FLAC Vorbis comments group album and artist correctly', async () => {
  const le=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
  const entries=['TITLE=Quietude','ARTIST=Artista local','ALBUM=Em casa'];
  const body=Buffer.concat([le(0),le(entries.length),...entries.flatMap(e=>[le(Buffer.byteLength(e)),Buffer.from(e)])]);
  const result=await parseMetadata(file(Buffer.concat([Buffer.from('fLaC'),Buffer.from([132,body.length>>16,(body.length>>8)&255,body.length&255]),body]),'quietude.flac'));
  assert.equal(result.title,'Quietude');assert.equal(result.artist,'Artista local');assert.equal(result.album,'Em casa');
});
test('generated demo is a valid 24-second PCM WAV', async () => {
  const demo=createDemo(),result=await parseMetadata(demo);
  assert.equal(result.duration,24);assert.equal(result.title,'Um lugar tranquilo');assert.equal(result.artist,'NEST Studio');
  const bytes=new Uint8Array(await demo.arrayBuffer());assert.equal(new TextDecoder().decode(bytes.subarray(0,4)),'RIFF');assert.ok(bytes.slice(44).some(b=>b!==0));
});
test('malformed and truncated metadata retain safe defaults', async () => {
  for(const bytes of [new Uint8Array(),Buffer.from('ID3'),Buffer.from([73,68,51,3,0,0,127,127,127,127]),Buffer.from('fLaC\x86\xff\xff\xff')]) {
    const result=await parseMetadata(file(bytes,'Local - Track.mp3'));assert.equal(result.title,'Track');assert.equal(result.artist,'Local');
  }
});
