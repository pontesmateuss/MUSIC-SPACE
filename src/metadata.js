const latin = new TextDecoder('iso-8859-1');
const utf8 = new TextDecoder('utf-8');
const ascii = bytes => String.fromCharCode(...bytes);
const uint32 = (data, offset) => new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset);
const synchsafe = (data, offset) => ((data[offset] & 127) << 21) | ((data[offset + 1] & 127) << 14) | ((data[offset + 2] & 127) << 7) | (data[offset + 3] & 127);
const clean = value => value.replace(/\0/g, '').trim();
function decodeText(bytes, encoding) {
  if (!bytes.length) return '';
  try { return clean((encoding === 0 ? latin : encoding === 1 ? new TextDecoder(bytes[0] === 254 ? 'utf-16be' : 'utf-16le') : encoding === 2 ? new TextDecoder('utf-16be') : utf8).decode(bytes)); } catch { return ''; }
}
function terminator(bytes, start, encoding) {
  const step = encoding === 1 || encoding === 2 ? 2 : 1;
  for (let i = start; i < bytes.length; i += step) if (bytes[i] === 0 && (step === 1 || bytes[i + 1] === 0)) return i + step;
  return bytes.length;
}
function picture(frame, v2 = false) {
  const encoding = frame[0];
  let pos = v2 ? 4 : terminator(frame, 1, 0);
  const mime = v2 ? (ascii(frame.subarray(1, 4)) === 'PNG' ? 'image/png' : 'image/jpeg') : latin.decode(frame.subarray(1, pos - 1));
  pos = terminator(frame, pos + 1, encoding);
  if (pos >= frame.length || !/^image\/(jpeg|png|webp)$/i.test(mime)) return undefined;
  return new Blob([frame.subarray(pos)], { type: mime });
}
function readID3(data, result) {
  if (ascii(data.subarray(0, 3)) !== 'ID3' || ![2, 3, 4].includes(data[3])) return;
  const version = data[3], end = Math.min(data.length, synchsafe(data, 6) + 10);
  // Unsynchronised tags are uncommon: retain filename fallback rather than misparse binary offsets.
  if (data[5] & 128) return;
  let pos = 10;
  if (data[5] & 64) pos += version === 4 ? synchsafe(data, pos) : uint32(data, pos) + 4;
  const fields = { TIT2:'title', TT2:'title', TPE1:'artist', TP1:'artist', TALB:'album', TAL:'album', TRCK:'trackNumber', TRK:'trackNumber' };
  const header = version === 2 ? 6 : 10;
  while (pos + header <= end) {
    const id = ascii(data.subarray(pos, pos + (version === 2 ? 3 : 4)));
    const size = version === 2 ? (data[pos + 3] << 16) | (data[pos + 4] << 8) | data[pos + 5] : version === 4 ? synchsafe(data, pos + 4) : uint32(data, pos + 4);
    if (!/^[A-Z0-9]{3,4}$/.test(id) || !size || pos + header + size > end) break;
    const frame = data.subarray(pos + header, pos + header + size);
    const flags = version === 2 ? 0 : data[pos + 9];
    if (!flags) {
      if (fields[id]) { const value = decodeText(frame.subarray(1), frame[0]); if (value) result[fields[id]] = value; }
      if (id === 'APIC' || id === 'PIC') result.cover ||= picture(frame, version === 2);
    }
    pos += header + size;
  }
}
function readFlac(data, result) {
  if (ascii(data.subarray(0, 4)) !== 'fLaC') return;
  let pos = 4;
  while (pos + 4 <= data.length) {
    const last = data[pos] & 128, type = data[pos] & 127;
    const size = (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
    pos += 4;
    if (pos + size > data.length) break;
    const block = data.subarray(pos, pos + size), view = new DataView(block.buffer, block.byteOffset, block.byteLength);
    if (type === 0 && size >= 18) {
      const rate = (block[10] << 12) | (block[11] << 4) | (block[12] >> 4);
      const samples = (block[13] & 15) * 4294967296 + view.getUint32(14);
      if (rate) result.duration = samples / rate;
    }
    if (type === 4 && size >= 8) {
      let p = 4 + view.getUint32(0, true);
      if (p + 4 <= size) {
        const count = view.getUint32(p, true); p += 4;
        for (let i = 0; i < count && p + 4 <= size; i++) {
          const length = view.getUint32(p, true); p += 4;
          if (p + length > size) break;
          const entry = utf8.decode(block.subarray(p, p + length)), equals = entry.indexOf('=');
          const field = { TITLE:'title', ARTIST:'artist', ALBUM:'album', TRACKNUMBER:'trackNumber' }[entry.slice(0, equals).toUpperCase()];
          if (field) result[field] = clean(entry.slice(equals + 1)); p += length;
        }
      }
    }
    if (type === 6 && size > 32) {
      try {
        let p = 4; const mimeLength = view.getUint32(p); p += 4;
        const mime = utf8.decode(block.subarray(p, p + mimeLength)); p += mimeLength;
        const descriptionLength = view.getUint32(p); p += 4 + descriptionLength + 16;
        const length = view.getUint32(p); p += 4;
        if (p + length <= size && /^image\/(jpeg|png|webp)$/.test(mime)) result.cover ||= new Blob([block.subarray(p, p + length)], { type:mime });
      } catch { /* A malformed picture must not prevent audio import. */ }
    }
    pos += size; if (last) break;
  }
}
function readWav(data, result) {
  if (ascii(data.subarray(0, 4)) !== 'RIFF' || ascii(data.subarray(8, 12)) !== 'WAVE') return;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 12, byteRate = 0;
  while (pos + 8 <= data.length) {
    const id = ascii(data.subarray(pos, pos + 4)), size = view.getUint32(pos + 4, true); pos += 8;
    if (id === 'fmt ' && pos + 12 <= data.length) byteRate = view.getUint32(pos + 8, true);
    if (id === 'data' && byteRate) result.duration = size / byteRate;
    if (id === 'LIST' && ascii(data.subarray(pos, pos + 4)) === 'INFO') {
      let p = pos + 4;
      while (p + 8 <= Math.min(pos + size, data.length)) {
        const field = { INAM:'title', IART:'artist', IPRD:'album' }[ascii(data.subarray(p, p + 4))];
        const length = view.getUint32(p + 4, true); p += 8;
        if (p + length > data.length) break;
        if (field) result[field] = clean(utf8.decode(data.subarray(p, p + length)));
        p += length + (length % 2);
      }
    }
    pos += size + (size % 2);
  }
}
export function fallbackMetadata(name) {
  const base = name.replace(/\.(mp3|flac|wav)$/i, ''), parts = base.split(' - ');
  return { title:parts.length > 1 ? parts.slice(1).join(' - ') : base, artist:parts.length > 1 ? parts[0] : 'Artista desconhecido', album:'Sem álbum', duration:0 };
}
export async function parseMetadata(file) {
  const result = fallbackMetadata(file.name);
  // Bound reads to keep large lossless imports light. Audio itself remains a Blob.
  const data = new Uint8Array(await file.slice(0, 16 * 1024 * 1024).arrayBuffer());
  try { readID3(data, result); readFlac(data, result); readWav(data, result); } catch { /* Preserve valid defaults for malformed tags. */ }
  if (file.name.toLowerCase().endsWith('.mp3') && result.artist === 'Artista desconhecido' && file.size >= 128) {
    const tail = new Uint8Array(await file.slice(-128).arrayBuffer());
    if (ascii(tail.subarray(0, 3)) === 'TAG') {
      result.title = clean(latin.decode(tail.subarray(3, 33))) || result.title;
      result.artist = clean(latin.decode(tail.subarray(33, 63))) || result.artist;
      result.album = clean(latin.decode(tail.subarray(63, 93))) || result.album;
    }
  }
  return result;
}
export function formatTime(value) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
