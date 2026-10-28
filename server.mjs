import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.env.STATIC_ROOT || fileURLToPath(new URL('./public/', import.meta.url))) + path.sep;
const port = Number(process.env.PORT || 3000);
const basePath = '/' + (process.env.BASE_PATH || '').replace(/^\/+|\/+$/g,'') + (process.env.BASE_PATH?.replace(/\//g,'') ? '/' : '');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  try {
    const incoming = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!incoming.startsWith(basePath)) { res.writeHead(404); res.end('Not found'); return; }
    const pathname = incoming.slice(basePath.length-1);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root) || !(await stat(file)).isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '0.0.0.0', () => console.log(`Doll Atelier listening on http://0.0.0.0:${port}`));
process.on('SIGTERM', () => server.close());
