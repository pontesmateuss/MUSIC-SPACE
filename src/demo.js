// An original, generated ambient loop. No external music or copyrighted recordings.
export function createDemo() {
  const rate = 22050, seconds = 24, count = rate * seconds;
  const buffer = new ArrayBuffer(44 + count * 2), view = new DataView(buffer);
  const text = (offset, string) => [...string].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, count * 2, true);
  const chords = [[130.81,164.81,196,246.94],[110,130.81,164.81,196],[87.31,130.81,174.61,220],[98,146.83,196,246.94]];
  for (let i = 0; i < count; i++) {
    const t = i / rate, local = t % 6, chord = chords[Math.floor(t / 6)];
    const envelope = Math.min(1, local / .6, (6 - local) / 1.3) * Math.min(1, t / 2, (seconds - t) / 3);
    let sample = chord.reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * t) * .055 + Math.sin(2 * Math.PI * f * 2 * t) * .012, 0) * envelope;
    const beat = t % .75, note = chord[Math.floor(t / .75) % 4] * 4;
    sample += Math.sin(2 * Math.PI * note * t) * Math.exp(-beat * 7) * .065 * Math.min(1, t, (seconds - t) / 2);
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }
  return new File([buffer], 'NEST Studio - Um lugar tranquilo.wav', { type:'audio/wav', lastModified:1 });
}
