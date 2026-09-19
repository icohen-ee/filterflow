import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FilterEngine } from './filter_engine.js';
import { generateQrSvg } from './qr.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3030', 10);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443', 10);
const engine = new FilterEngine();

// Active SSE client response connections for real-time multi-device sync
const sseClients = new Set();

export function broadcastEvent(eventType, data = {}) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

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
  // Real-Time Server-Sent Events (SSE) stream for cross-device sync
  if (pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now(), clients: sseClients.size + 1 })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // Household & Device Sharing Metadata (QR code, Wi-Fi IP, and installation guides)
  if (pathname === '/api/household/share' && req.method === 'GET') {
    const networkHost = '192.168.86.47';
    const httpUrl = `http://${networkHost}:${PORT}`;
    const httpsUrl = `https://${networkHost}:${HTTPS_PORT}`;
    const qrSvg = generateQrSvg(httpUrl, { size: 240, margin: 3 });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      networkHost,
      port: PORT,
      httpsPort: HTTPS_PORT,
      httpUrl,
      httpsUrl,
      localUrl: `http://localhost:${PORT}`,
      qrSvg,
      iosGuide: {
        title: "Wife's iPhone (iOS 16.4+)",
        steps: [
          "Connect to home Wi-Fi and scan the QR code with iPhone Camera (or open in Safari)",
          "Tap the Share button (⎋) in Safari bottom toolbar",
          "Select 'Add to Home Screen' (➕) and tap Add",
          "FilterFlow launches as a standalone app with instant load and badge support!"
        ]
      },
      androidGuide: {
        title: "Pixel 10 Pro (Android / WebAPK)",
        steps: [
          "Open link in Google Chrome",
          "Tap the 'Install app' prompt or Chrome menu (⋮) -> 'Install App'",
          "FilterFlow installs as a first-class WebAPK in your app drawer with notification channels"
        ]
      },
      whatsappAssistant: {
        title: "OpenClaw WhatsApp Assistant",
        description: "Both Isaac & Wife can query or update filters conversationally",
        sampleQueries: [
          "What filters are due?",
          "When is the fridge filter due?",
          "Replaced fridge filter today",
          "Snooze HVAC filter 14 days",
          "Who replaced the HVAC filter last?",
          "Buy car cabin filter"
        ]
      }
    }));
    return;
  }

  // Natural Language Assistant Query Dispatcher
  if (pathname === '/api/assistant/query' && req.method === 'POST') {
    try {
      const data = await readBody(req);
      const query = data.query || '';
      const from = data.from || data.fromUser || data.by || 'Household';
      const result = engine.handleAssistantCommand(query, from);
      if (result.actionTaken === 'mark_replaced' || result.actionTaken === 'snooze') {
        broadcastEvent('filter_updated', { action: result.actionTaken, filter: result.filter });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/filters' && req.method === 'GET') {
    const owner = url.searchParams.get('owner');
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const filters = engine.getAllFilters(new Date(), { owner, category, status });
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
      broadcastEvent('filter_created', { filter: created });
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
    const replacedBy = body && body.replacedBy ? body.replacedBy : 'Household';
    try {
      const updated = engine.markReplaced(id, replacedDate, notes, replacedBy);
      if (!updated) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Filter not found' }));
        return;
      }
      broadcastEvent('filter_updated', { action: 'replace', filter: updated });
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
      const by = data.by || 'Household';
      const reason = data.reason || `Snoozed by ${by} for vacation/low usage`;
      const updated = engine.snooze(id, days, reason);
      if (!updated) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Filter not found' }));
        return;
      }
      broadcastEvent('filter_updated', { action: 'snooze', filter: updated });
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
    broadcastEvent('filter_deleted', { id });
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
