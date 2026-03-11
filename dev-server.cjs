const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const urlFile = path.join(root, '.dev-server-url');
const candidates = process.env.PORT ? [Number(process.env.PORT)] : [3000, 3001, 4173, 8080];

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function resolveTarget(cleanPath) {
  const candidates = [];
  const normalized = cleanPath.replace(/^\/+/, '');
  const direct = path.join(root, normalized);
  candidates.push(direct);
  if (!path.extname(normalized)) {
    candidates.push(path.join(root, `${normalized}.html`));
    candidates.push(path.join(root, normalized, 'index.html'));
  }
  if (cleanPath === '/' || cleanPath === '') {
    candidates.unshift(path.join(root, 'index.html'));
  }

  for (const candidate of candidates) {
    if (!candidate.startsWith(root)) continue;
    if (fs.existsSync(candidate)) {
      const stat = fs.statSync(candidate);
      if (stat.isDirectory()) {
        const indexCandidate = path.join(candidate, 'index.html');
        if (fs.existsSync(indexCandidate)) return indexCandidate;
        continue;
      }
      return candidate;
    }
  }

  return null;
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  const cleanPath = decodeURIComponent(requestUrl.pathname);
  const target = resolveTarget(cleanPath);

  if (target) {
    return sendFile(target, res);
  }

  const fallback404 = path.join(root, '404.html');
  if (fs.existsSync(fallback404)) {
    res.statusCode = 404;
    return sendFile(fallback404, res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

function tryListen(index = 0) {
  const port = candidates[index];
  if (!port) {
    console.error('No available development port found.');
    process.exit(1);
  }

  server.once('error', error => {
    if (error.code === 'EADDRINUSE' && index < candidates.length - 1) {
      tryListen(index + 1);
      return;
    }
    console.error(error);
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    fs.writeFileSync(urlFile, `${url}\n`);
    console.log(`IslamiCalc local server running at ${url}`);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    try { fs.rmSync(urlFile, { force: true }); } catch {}
    server.close(() => process.exit(0));
  });
}

tryListen();
