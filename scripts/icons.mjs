import { deflateSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const crc = buffer => { let value = 0xffffffff; for (const b of buffer) { value ^= b; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); } return (value ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const name = Buffer.from(type), body = Buffer.concat([name, data]), header = Buffer.alloc(4), tail = Buffer.alloc(4); header.writeUInt32BE(data.length); tail.writeUInt32BE(crc(body)); return Buffer.concat([header,body,tail]); }
function distance(x,y,a,b) { const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))); return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy); }
const segments = [];
function curve(a,b,c,d) { let previous=a; for (let i=1;i<=30;i++) { const t=i/30,u=1-t; const p=[u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]; segments.push([previous,p]); previous=p; } }
for (const [start,end] of [[176,272],[248,336],[320,384]]) { curve([128,start],[188,start+8],[226,end-48],[256,end]); curve([256,end],[286,end-48],[324,start+8],[384,start]); }
segments.push([[256,112],[256,184]],[[216,128],[256,88]],[[256,88],[296,128]]);
for (const size of [192,512]) {
  const data=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const px=(x+.5)*512/size,py=(y+.5)*512/size;
    const dist=Math.min(...segments.map(([a,b])=>distance(px,py,a,b)));
    const blend=Math.max(0,Math.min(1,(12-dist)*size/512+.5));
    const offset=y*(size*4+1)+1+x*4;
    for(let c=0;c<3;c++) data[offset+c]=Math.round([15,23,42][c]*(1-blend)+[6,182,212][c]*blend);
    data[offset+3]=255;
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  await writeFile(fileURLToPath(new URL(`../assets/icon-${size}.png`,import.meta.url)),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(data)),chunk('IEND',Buffer.alloc(0))]));
}
console.log('PWA icons generated (192px, 512px).');
