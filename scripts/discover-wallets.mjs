#!/usr/bin/env node
// ExitRadar — wallet auto-discovery (seeds WATCH_ADDRESSES).
//
// Finds candidate trader wallets WITHOUT manual copy/paste:
//   token mint -> top holders (Helius getTokenLargestAccounts)
//             -> owner wallets (getMultipleAccounts jsonParsed)
//             -> keep only REAL wallets (System-Program-owned); drop AMM pools / program PDAs.
//
// Run on the VPS (Helius is reachable there). Node >= 18, zero dependencies.
//
//   HELIUS_API_KEY=xxx node scripts/discover-wallets.mjs <MINT_1> <MINT_2> ...
//   HELIUS_API_KEY=xxx node scripts/discover-wallets.mjs            # no mints -> Dexscreener trending (Solana)
//   # or put one mint per line in scripts/mints.txt and run with no args
//
// Output: prints `WATCH_ADDRESSES=...` and writes scripts/watch-addresses.txt
// (merging with existing entries, so re-runs / a nightly cron keep accumulating).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KEY = process.env.HELIUS_API_KEY;
if (!KEY) {
  console.error('✗ Set HELIUS_API_KEY first.  e.g.  HELIUS_API_KEY=xxx node scripts/discover-wallets.mjs <MINT>');
  process.exit(1);
}
const RPC = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;
const HOLDERS = Number(process.env.HOLDERS_PER_TOKEN || 20);
const SYS = '11111111111111111111111111111111'; // System Program — owner of a normal wallet account
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DENY = new Set([SYS]);

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, 'watch-addresses.txt');
const MINTS_FILE = join(DIR, 'mints.txt');

const uniq = (a) => [...new Set(a)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function rpc(method, params, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      return j.result;
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(400 * (i + 1));
    }
  }
}

async function trendingSolanaMints() {
  try {
    const r = await fetch('https://api.dexscreener.com/token-boosts/top/v1', { headers: { accept: 'application/json' } });
    const list = await r.json();
    return uniq(
      (Array.isArray(list) ? list : [])
        .filter((t) => t.chainId === 'solana' && B58.test(t.tokenAddress || ''))
        .map((t) => t.tokenAddress),
    );
  } catch (e) {
    console.warn('  ! could not fetch trending from Dexscreener:', e.message);
    return [];
  }
}

async function getMints() {
  const args = process.argv.slice(2).filter(Boolean);
  if (args.length) return args;
  if (existsSync(MINTS_FILE)) {
    return readFileSync(MINTS_FILE, 'utf8').split(/\s+/).map((s) => s.trim()).filter(Boolean);
  }
  console.log('→ no mints given — pulling trending Solana tokens from Dexscreener…');
  return trendingSolanaMints();
}

async function main() {
  const mints = uniq(await getMints()).filter((m) => B58.test(m));
  if (!mints.length) {
    console.error('✗ No token mints to scan. Pass mints as args, list them in scripts/mints.txt, or check network.');
    process.exit(1);
  }
  console.log(`→ scanning ${mints.length} token(s), top ${HOLDERS} holders each…`);

  // 1) mint -> top holder token accounts
  const tokenAccounts = [];
  for (const mint of mints) {
    try {
      const res = await rpc('getTokenLargestAccounts', [mint]);
      const accts = (res?.value || []).slice(0, HOLDERS).map((v) => v.address);
      tokenAccounts.push(...accts);
      console.log(`  ${mint}: ${accts.length} holder accounts`);
    } catch (e) {
      console.warn(`  ! ${mint}: ${e.message}`);
    }
    await sleep(200);
  }

  // 2) token accounts -> owner wallets
  let owners = [];
  for (const part of chunk(uniq(tokenAccounts), 100)) {
    try {
      const res = await rpc('getMultipleAccounts', [part, { encoding: 'jsonParsed' }]);
      for (const acc of res?.value || []) {
        const owner = acc?.data?.parsed?.info?.owner;
        if (owner) owners.push(owner);
      }
    } catch (e) {
      console.warn(`  ! owner resolve: ${e.message}`);
    }
    await sleep(200);
  }
  owners = uniq(owners).filter((o) => B58.test(o) && !DENY.has(o));

  // 3) keep only real wallets (System-Program-owned); drop AMM pools / program PDAs
  const wallets = [];
  for (const part of chunk(owners, 100)) {
    try {
      const res = await rpc('getMultipleAccounts', [part, { encoding: 'base64' }]);
      (res?.value || []).forEach((acc, i) => {
        if (acc === null || acc.owner === SYS) wallets.push(part[i]);
      });
    } catch (e) {
      wallets.push(...part); // on failure, keep rather than drop
      console.warn(`  ! wallet filter: ${e.message}`);
    }
    await sleep(200);
  }

  // 4) merge with existing, write + print
  const existing = existsSync(OUT)
    ? readFileSync(OUT, 'utf8').split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const all = uniq([...existing, ...wallets]).filter((a) => B58.test(a));
  writeFileSync(OUT, all.join('\n') + '\n');

  console.log(`\n✓ ${wallets.length} wallet(s) found this run · ${all.length} total saved to ${OUT}`);
  console.log('\nPaste this into the worker env:\n');
  console.log('WATCH_ADDRESSES=' + all.join(','));
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
