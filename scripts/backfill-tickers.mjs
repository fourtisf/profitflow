#!/usr/bin/env node
// Backfill REAL token symbols into existing pf_events rows (replaces the $MINT-prefix placeholders).
// Uses Helius DAS getAsset; updates via psql. Run on the VPS:
//   HELIUS_API_KEY=xxx DATABASE_URL="postgresql://pf:pf_strong_pw@127.0.0.1:5433/profitflow" \
//     node scripts/backfill-tickers.mjs
import { execSync } from 'node:child_process';

const KEY = process.env.HELIUS_API_KEY;
const DB = process.env.DATABASE_URL;
if (!KEY || !DB) {
  console.error('✗ Set HELIUS_API_KEY and DATABASE_URL first.');
  process.exit(1);
}
const RPC = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;
const psql = (sql) => execSync(`psql ${JSON.stringify(DB)} -tAc ${JSON.stringify(sql)}`, { encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function symbol(mint) {
  try {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAsset', params: { id: mint } }),
    });
    const j = await r.json();
    const s = j?.result?.token_info?.symbol ?? j?.result?.content?.metadata?.symbol;
    if (s) return '$' + String(s).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
  } catch {
    /* ignore */
  }
  return null;
}

const mints = psql('SELECT DISTINCT mint FROM pf_events').split('\n').map((s) => s.trim()).filter(Boolean);
console.log(`Resolving symbols for ${mints.length} token(s)…`);
let updated = 0;
for (const mint of mints) {
  const sym = await symbol(mint);
  if (sym && /^\$[A-Z0-9]{1,13}$/.test(sym)) {
    psql(`UPDATE pf_events SET ticker='${sym}' WHERE mint='${mint}'`);
    updated++;
    console.log(`  ${mint.slice(0, 6)}… -> ${sym}`);
  }
  await sleep(150); // gentle on Helius
}
console.log(`✓ Updated ${updated}/${mints.length} tokens. Restart exitradar-api to refresh its cache.`);
