#!/usr/bin/env node
// Minimal zero-dependency static file server for the ProfitFlow landing page.
//
// Safe-by-default: serves a single directory, blocks path traversal, GET/HEAD
// only. Bind/port are configurable via env (see ecosystem.config.js).
//
// NOTE: the page it serves (landing-page/profitflow.html) uses SIMULATED data
// — it is a marketing/demo artifact, not the live product (see HANDOFF.md).
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '8080', 10);
const ROOT = path.resolve(__dirname, '..', process.env.STATIC_DIR || 'landing-page');
const INDEX = process.env.INDEX || 'profitflow.html';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Method Not Allowed');
  }

  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath.endsWith('/')) urlPath += INDEX;

  const filePath = path.join(ROOT, path.normalize(urlPath));
  // Path-traversal guard: the resolved path must stay under ROOT.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'public, max-age=300',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`profitflow-landing: serving ${ROOT} at http://${HOST}:${PORT}/`);
});
