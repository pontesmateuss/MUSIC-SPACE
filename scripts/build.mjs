import { mkdir, copyFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
await import('./icons.mjs');
await mkdir(path.join(root, 'dist'), { recursive:true });
for (const file of ['index.html','sw.js','manifest.webmanifest']) await copyFile(path.join(root,file),path.join(root,'dist',file));
for (const dir of ['src','assets']) await cp(path.join(root,dir),path.join(root,'dist',dir),{ recursive:true });
console.log('Production application built in dist/. No runtime dependencies or external requests.');
