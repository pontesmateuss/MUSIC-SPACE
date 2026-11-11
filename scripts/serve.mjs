import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', process.argv.includes('--dist') ? 'dist' : '.');
const portIndex = process.argv.indexOf('--port');
const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 4173;
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json', '.wav':'audio/wav' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.')) || !['GET','HEAD'].includes(request.method)) { response.writeHead(403); response.end('Forbidden'); return; }
    if (!(await stat(target)).isFile()) throw new Error('Not a file');
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type':types[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.listen(port, '0.0.0.0', () => console.log(`Music Space ready: http://localhost:${port}`));
