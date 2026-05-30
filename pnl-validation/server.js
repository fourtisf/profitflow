#!/usr/bin/env node
// ProfitFlow — wallet realized-PnL API (zero-dependency, Node 18+).
//
//   GET /api/pnl?wallet=<addr>&mint=<tokenMint>[&sol=<flat SOL price>]
//   GET /api/health
//
// Reconstructs a wallet's cost basis for ONE token from its on-chain history
// (via Helius) and runs the shared pnl-engine. Binds 127.0.0.1 by default so it
// sits behind nginx. The Helius key is read from env and never leaves the server.
//
//   HELIUS_API_KEY=xxx PORT=8090 node server.js
//
// NOTE: SOL→USD is a flat estimate here (same caveat as validate.js) — good for
// a sanity number, not for exact historical accuracy. See README / FAQ.
'use strict';

const http = require('http');
const { computeAverageCost, computeFIFO } = require('./pnl-engine');

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const STABLES = new Set([USDC, USDT]);
const EPS = 1e-9;
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // base58, Solana address shape

// --- swap parsing (mirrors validate.js; kept self-contained) ----------------
function tokenDelta(tx, mint, wallet) {
  let d = 0;
  for (const t of tx.tokenTransfers || []) {
    if (t.mint !== mint) continue;
    const a = Number(t.tokenAmount) || 0;
    if (t.toUserAccount === wallet) d += a;
    if (t.fromUserAccount === wallet) d -= a;
  }
  return d;
}
function valueDelta(tx, wallet, flat) {
  let usd = 0;
  for (const n of tx.nativeTransfers || []) {
    const sol = (Number(n.amount) || 0) / 1e9;
    if (n.toUserAccount === wallet) usd += sol * flat;
    if (n.fromUserAccount === wallet) usd -= sol * flat;
  }
  for (const t of tx.tokenTransfers || []) {
    if (!STABLES.has(t.mint)) continue;
    const a = Number(t.tokenAmount) || 0;
    if (t.toUserAccount === wallet) usd += a;
    if (t.fromUserAccount === wallet) usd -= a;
  }
  return usd;
}
function classify(tx, mint, wallet, flat) {
  const td = tokenDelta(tx, mint, wallet);
  if (Math.abs(td) < EPS) return null;
  const vd = valueDelta(tx, wallet, flat);
  const base = { ts: tx.timestamp, sig: tx.signature };
  if (td > 0 && vd < -EPS) return { kind: 'buy', amount: td, usd: -vd, ...base };
  if (td < 0 && vd > EPS) return { kind: 'sell', amount: -td, usd: vd, ...base };
  if (td > 0) return { kind: 'transfer_in', amount: td, ...base };
  return { kind: 'transfer_out', amount: -td, ...base };
}

// pure: parsed txs -> result payload (unit-testable, no network)
function pnlFromTransactions(txs, mint, wallet, flat) {
  const events = txs.map(t => classify(t, mint, wallet, flat)).filter(Boolean).sort((a, b) => a.ts - b.ts);
  if (!events.length) {
    return { events: 0, ledger: [], summary: null, warnings: ['no activity for this token in this wallet'] };
  }
  const r = computeAverageCost(events);
  const f = computeFIFO(events);
  return {
    events: events.length,
    ledger: r.ledger,
    summary: {
      realizedPnL: r.realizedPnL,
      totalProceeds: r.totalProceeds,
      costOfSold: r.costOfSold,
      multipleOnSold: r.multipleOnSold,
      tokensRemaining: r.tokensRemaining,
      costBasisRemaining: r.costBasisRemaining,
      avgEntryRemaining: r.avgEntryRemaining,
      fifoRealized: f.realizedPnL,
    },
    warnings: r.warnings,
  };
}

async function fetchAll(addr, key, maxPages) {
  const out = [];
  let before = '';
  for (let p = 0; p < maxPages; p++) {
    const url = `https://api.helius.xyz/v0/addresses/${addr}/transactions`
      + `?api-key=${key}&limit=100${before ? `&before=${before}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`helius_${res.status}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || !batch.length) break;
    out.push(...batch);
    before = batch[batch.length - 1].signature;
    if (batch.length < 100) break;
  }
  return out;
}

function createServer(opts = {}) {
  const KEY = opts.key ?? process.env.HELIUS_API_KEY ?? '';
  const MAX_PAGES = parseInt(opts.maxPages ?? process.env.MAX_PAGES ?? '50', 10);
  const RL_MAX = parseInt(opts.rateLimit ?? process.env.RATE_LIMIT ?? '20', 10);

  const hits = new Map(); // ip -> timestamps (60s window)
  function rateLimited(ip) {
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
    arr.push(now);
    hits.set(ip, arr);
    return arr.length > RL_MAX;
  }
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.every(t => now - t > 60000)) hits.delete(k);
  }, 120000);
  if (sweep.unref) sweep.unref();

  const send = (res, code, obj) => {
    const b = JSON.stringify(obj);
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(b),
      'Cache-Control': 'no-store',
    });
    res.end(b);
  };

  return http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://x');
      if (req.method === 'GET' && u.pathname === '/api/health') {
        return send(res, 200, { ok: true, keyConfigured: !!KEY });
      }
      if (req.method !== 'GET' || u.pathname !== '/api/pnl') {
        return send(res, 404, { error: 'not_found' });
      }
      if (!KEY) return send(res, 500, { error: 'server_misconfigured', detail: 'HELIUS_API_KEY not set' });

      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
        || req.socket.remoteAddress || '?';
      if (rateLimited(ip)) return send(res, 429, { error: 'rate_limited', detail: `max ${RL_MAX}/min` });

      const wallet = (u.searchParams.get('wallet') || '').trim();
      const mint = (u.searchParams.get('mint') || '').trim();
      const flat = Number(u.searchParams.get('sol')) || 150;
      if (!B58.test(wallet)) return send(res, 400, { error: 'bad_wallet', detail: 'not a valid Solana address' });
      if (!B58.test(mint)) return send(res, 400, { error: 'bad_mint', detail: 'token mint address required' });

      const txs = await fetchAll(wallet, KEY, MAX_PAGES);
      const out = pnlFromTransactions(txs, mint, wallet, flat);
      send(res, 200, { wallet, mint, solUsd: flat, ...out });
    } catch (e) {
      send(res, 502, { error: 'upstream', detail: String((e && e.message) || e) });
    }
  });
}

if (require.main === module) {
  const HOST = process.env.HOST || '127.0.0.1';
  const PORT = parseInt(process.env.PORT || '8090', 10);
  createServer().listen(PORT, HOST, () =>
    console.log(`profitflow-api: http://${HOST}:${PORT}/api/pnl (helius key ${process.env.HELIUS_API_KEY ? 'set' : 'MISSING'})`));
}

module.exports = { classify, pnlFromTransactions, fetchAll, createServer };
