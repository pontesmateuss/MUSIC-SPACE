import { readFile, writeFile } from 'node:fs/promises';

// The checked-in sizes are exports of assets/brand.png (the supplied artwork).
// Validate them during builds instead of overwriting them with the old logo.
for (const size of [32, 180, 192, 512]) {
  const data = await readFile(new URL(`../assets/icon-${size}.png`, import.meta.url));
  if (data.toString('hex', 0, 8) !== '89504e470d0a1a0a' ||
      data.readUInt32BE(16) !== size || data.readUInt32BE(20) !== size) {
    throw new Error(`Invalid icon-${size}.png: expected a ${size}x${size} PNG.`);
  }
}
// Keep legacy SVG entry points consistent with the current brand as well.
const png = await readFile(new URL('../assets/icon-512.png', import.meta.url));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,${png.toString('base64')}"/></svg>\n`;
for (const name of ['icon.svg', 'mark.svg']) {
  await writeFile(new URL(`../assets/${name}`, import.meta.url), svg);
}
console.log('Brand icons verified (32, 180, 192 and 512px).');

// Windows shortcuts use ICO containers, with PNG frames for crisp scaling.
const sizes = [32, 192];
const frames = await Promise.all(sizes.map(size => readFile(new URL(`../assets/icon-${size}.png`, import.meta.url))));
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
frames.forEach((frame, i) => {
  const entry = 6 + i * 16;
  directory[entry] = directory[entry + 1] = sizes[i];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile(new URL('../assets/music-space.ico', import.meta.url), Buffer.concat([directory, ...frames]));
