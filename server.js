import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FilterEngine } from './filter_engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3030', 10);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443', 10);
const engine = new FilterEngine();

// Load SSL Certificates
const certPath = path.join(__dirname, 'certs', 'cert.pem');
const keyPath = path.join(__dirname, 'certs', 'key.pem');
let cert, key;
try {
  cert = fs.readFileSync(certPath);
  key = fs.readFileSync(keyPath);
} catch (err) {
  console.warn('⚠️ SSL certificates not found at certs/. Run cert generator if HTTPS fails.', err.message);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

const requestHandler = async (req, res) => {
  const isHttps = !!req.socket.encrypted;
  const protocol = isHttps ? 'https' : 'http';
  const host = req.headers.host || `localhost:${PORT}`;
  const url = new URL(req.url, `${protocol}://${host}`);
  const pathname = url.pathname;
  const clientIp = req.socket.remoteAddress || 'unknown';

  console.log(`[${new Date().toISOString()}] [${protocol.toUpperCase()}] ${req.method} ${pathname} (from ${clientIp})`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API Endpoints ---
  if (pathname === '/api/filters' && req.method === 'GET') {
    const filters = engine.getAllFilters();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filters));
    return;
  }

  if (pathname === '/api/notifications' && req.method === 'GET') {
    const alerts = engine.getNotifications();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(alerts));
    return;
  }

  if (pathname === '/api/filters' && req.method === 'POST') {
    try {
      const data = await readBody(req);
      const created = engine.addFilter(data);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(created));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  const replaceMatch = pathname.match(/^\/api\/filters\/([^/]+)\/replace$/);
  if (replaceMatch && req.method === 'POST') {
    const id = replaceMatch[1];
    let body = {};
    try {
      body = await readBody(req);
    } catch {
      body = {};
    }
    const replacedDate = body && body.replacedDate ? body.replacedDate : new Date().toISOString().split('T')[0];
    const notes = body && body.notes ? body.notes : '';
    try {
      const updated = engine.markReplaced(id, replacedDate, notes);
      if (!updated) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Filter not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(updated));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  const snoozeMatch = pathname.match(/^\/api\/filters\/([^/]+)\/snooze$/);
  if (snoozeMatch && req.method === 'POST') {
    const id = snoozeMatch[1];
    try {
      const data = await readBody(req);
      const days = parseInt(data.days !== undefined ? data.days : 30, 10);
      const updated = engine.snooze(id, days);
      if (!updated) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Filter not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(updated));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  const deleteMatch = pathname.match(/^\/api\/filters\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const id = deleteMatch[1];
    const deleted = engine.deleteFilter(id);
    if (!deleted) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Filter not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // --- Static File Serving (with path traversal protection) ---
  const publicDir = path.resolve(__dirname, 'public');
  const safePath = path.resolve(publicDir, pathname === '/' ? 'index.html' : '.' + pathname);

  if (safePath.startsWith(publicDir) && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    const ext = path.extname(safePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(safePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
};

// Create internal HTTP and HTTPS listeners
const httpServer = http.createServer(requestHandler);
const httpsServerProxy = cert && key ? https.createServer({ cert, key }, requestHandler) : null;
const httpsServerDirect = cert && key ? https.createServer({ cert, key }, requestHandler) : null;

httpServer.on('clientError', (err, socket) => {
  console.log(`[HTTP clientError] ${err.message} from ${socket.remoteAddress}`);
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  }
});

if (httpsServerProxy) {
  httpsServerProxy.on('clientError', (err, socket) => {
    console.log(`[HTTPS Proxy clientError] ${err.message} from ${socket.remoteAddress}`);
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    }
  });
}

// Multiplexing TCP server on PORT (e.g. 3030): handles BOTH HTTP & HTTPS!
const dualServer = net.createServer((socket) => {
  socket.once('data', (buffer) => {
    socket.pause();
    socket.unshift(buffer);

    // 0x16 = 22 = TLS Handshake ClientHello
    if (buffer[0] === 22 && httpsServerProxy) {
      httpsServerProxy.emit('connection', socket);
    } else {
      httpServer.emit('connection', socket);
    }
    process.nextTick(() => socket.resume());
  });
});

dualServer.on('error', (err) => {
  console.error('DualServer error:', err);
});

// Start dual server on port 3030
dualServer.listen(PORT, () => {
  console.log(`🚀 FilterFlow Server running on port ${PORT} (Dual HTTP & HTTPS enabled)`);
  console.log(`   👉 HTTP:  http://192.168.86.47:${PORT}`);
  console.log(`   👉 HTTPS: https://192.168.86.47:${PORT}`);
});

// Also start dedicated HTTPS server on HTTPS_PORT (e.g. 3443)
if (httpsServerDirect) {
  httpsServerDirect.listen(HTTPS_PORT, () => {
    console.log(`🔒 FilterFlow Dedicated HTTPS running on port ${HTTPS_PORT}`);
    console.log(`   👉 HTTPS: https://192.168.86.47:${HTTPS_PORT}`);
  });
}
