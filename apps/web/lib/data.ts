import {
  BaseDataSource,
  config,
  shortWallet,
  tierFor,
  type LeaderboardEntry,
  type LeaderboardRange,
  type RealizedExit,
  type Source,
  type TokenProfile,
  type WalletProfile,
} from '@profitflow/shared';
import { API_URL } from './site';

// ─────────────────────────────────────────────────────────────────────────────
// Server-side data access for the wallet / token / leaderboard pages.
//   • API_URL set  → read the real API (same shapes the WebSocket feed uses).
//   • API_URL unset → DEMO: generate DETERMINISTIC data seeded by the address/mint,
//     so every page renders believable, stable content (good for screenshots/SEO)
//     with no backend. Numbers mirror what the engine produces for a buy→sell
//     (and the transfer_in "unverified basis" trap), so the demo never lies with a
//     fake "+∞×".
// ─────────────────────────────────────────────────────────────────────────────

/** Are we serving generated demo data (no backend wired)? */
export const IS_DEMO = !API_URL;

async function apiGet<T>(path: string): Promise<T | null> {
  if (!API_URL) return null;
  try {
    const r = await fetch(`${API_URL}${path}`, { next: { revalidate: 15 } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null; // API down → fall back to demo so the page still renders
  }
}

// ── deterministic RNG (xfnv1a hash → mulberry32) ─────────────────────────────
function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOKENS = [
  '$WIF', '$POPCAT', '$MOODENG', '$GIGA', '$PNUT', '$BONK', '$MEW',
  '$FWOG', '$GOAT', '$ZEREBRO', '$AI16Z', '$CHILLGUY', '$PONKE',
];
const SOURCES: Source[] = ['pump.fun', 'Raydium', 'Meteora'];
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}
function b58(rand: () => number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += B58[Math.floor(rand() * B58.length)];
  return s;
}

/** One synthetic exit. Mirrors packages/shared/src/sim.ts for a 2-event buy→sell. */
function genExit(
  rand: () => number,
  opts: { ts: number; wallet?: string; mint?: string; ticker?: string },
): RealizedExit {
  const big = rand() < 0.18;
  const ticker = opts.ticker ?? pick(rand, TOKENS);
  const wallet = opts.wallet ?? b58(rand, 44);
  const sig = b58(rand, 64);
  const unverifiedBasis = rand() < 0.08; // transfer_in → unknown basis

  const pnlTarget = big ? 80_000 + rand() * 700_000 : config.proMinUsd + rand() * 48_000;
  const mult = big ? 12 + rand() * 180 : 1.4 + rand() * 18;
  const entry = pnlTarget / (mult - 1);
  const proceeds = entry + pnlTarget;
  // transfer_in: zero basis → the whole proceeds realize; never a fake multiple.
  const pnlUsd = Math.round(unverifiedBasis ? proceeds : pnlTarget);

  return {
    id: sig,
    sig,
    ts: opts.ts,
    ticker,
    mint: opts.mint ?? b58(rand, 44),
    wallet,
    walletShort: shortWallet(wallet),
    entryUsd: unverifiedBasis ? 0 : Math.round(entry),
    proceedsUsd: Math.round(proceeds),
    pnlUsd,
    multiple: unverifiedBasis ? null : Math.round((proceeds / entry) * 100) / 100,
    source: pick(rand, SOURCES),
    unverifiedBasis,
    tier: tierFor(pnlUsd),
  };
}

/** Concrete BaseDataSource so we reuse its tested leaderboard/wallet/token aggregation. */
class DemoSource extends BaseDataSource {
  readonly name = 'demo';
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  add(e: RealizedExit): void {
    this.publish(e);
  }
}

const DAY = 86_400_000;

export async function getLeaderboard(
  range: LeaderboardRange,
  limit = 25,
): Promise<{ range: LeaderboardRange; entries: LeaderboardEntry[] }> {
  const real = await apiGet<{ range: LeaderboardRange; entries: LeaderboardEntry[] }>(
    `/api/leaderboard?range=${range}&limit=${limit}`,
  );
  if (real) return real;

  const src = new DemoSource();
  const rand = rng('leaderboard:' + range);
  const now = Date.now();
  const span = range === 'week' ? 6 * DAY : 110 * DAY;
  for (let w = 0; w < 48; w++) {
    const wallet = b58(rand, 44);
    const exits = 1 + Math.floor(rand() * 5);
    for (let i = 0; i < exits; i++) src.add(genExit(rand, { ts: now - rand() * span, wallet }));
  }
  return { range, entries: src.getLeaderboard(range, limit) };
}

export async function getWallet(address: string): Promise<WalletProfile | null> {
  const real = await apiGet<WalletProfile>(`/api/wallet/${encodeURIComponent(address)}`);
  if (real) return real;
  if (API_URL) return null; // live mode: genuinely not in the current window

  const src = new DemoSource();
  const rand = rng('wallet:' + address);
  const now = Date.now();
  const n = 4 + Math.floor(rand() * 9); // 4..12 exits
  for (let i = 0; i < n; i++) src.add(genExit(rand, { ts: now - Math.floor(rand() * 50 * DAY), wallet: address }));
  return src.getWallet(address);
}

export async function getToken(mint: string): Promise<TokenProfile | null> {
  const real = await apiGet<TokenProfile>(`/api/token/${encodeURIComponent(mint)}`);
  if (real) return real;
  if (API_URL) return null;

  const src = new DemoSource();
  const rand = rng('token:' + mint);
  const now = Date.now();
  const ticker = pick(rand, TOKENS);
  const n = 6 + Math.floor(rand() * 14); // 6..19 exits across varied wallets
  // Cluster recent exits into a few days so the "distribution" signal is demonstrable.
  for (let i = 0; i < n; i++) src.add(genExit(rand, { ts: now - Math.floor(rand() * 4 * DAY), mint, ticker }));
  return src.getToken(mint);
}
