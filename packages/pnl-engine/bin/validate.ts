// validate.ts — run locally with your own Helius key.
//   HELIUS_API_KEY=xxx pnpm validate <WALLET> <TOKEN_MINT> [SOL_USD]
//
// Pulls the wallet's full parsed history from Helius, isolates swaps/transfers of TOKEN_MINT,
// converts the value-leg (SOL + USDC/USDT) to USD, then runs the realized-PnL engine.
// Compare the printed ledger line-by-line against Solscan to verify accuracy (HANDOFF Task 1).
//
// Requires Node 18+ (global fetch).
import { computeAverageCost, computeFIFO, type PositionEvent } from '../src/engine.js';

const KEY = process.env.HELIUS_API_KEY;
const [, , WALLET, MINT, SOL_USD_ARG] = process.argv;

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const STABLES = new Set([USDC, USDT]);
const EPS = 1e-9;

if (!KEY || !WALLET || !MINT) {
  console.error('Usage: HELIUS_API_KEY=xxx pnpm validate <WALLET> <TOKEN_MINT> [SOL_USD]');
  console.error('  SOL_USD optional flat override. For real accuracy use per-timestamp pricing (see NOTE below).');
  process.exit(1);
}

interface HeliusTransfer {
  mint?: string;
  tokenAmount?: number | string;
  amount?: number | string;
  fromUserAccount?: string;
  toUserAccount?: string;
}
interface HeliusTx {
  signature: string;
  timestamp: number;
  tokenTransfers?: HeliusTransfer[];
  nativeTransfers?: HeliusTransfer[];
}

// --- SOL -> USD --------------------------------------------------------------
// NOTE: a single flat price is WRONG for historical accuracy. Production (M3) must price each
// swap at its block timestamp (Birdeye/Pyth history). This flat override exists only so the
// validation run produces a number you can sanity-check. It is clearly the biggest error source.
const FLAT_SOL = Number(SOL_USD_ARG) || 150;
function solToUsd(_ts: number, sol: number): number {
  return sol * FLAT_SOL;
}

async function fetchAll(addr: string): Promise<HeliusTx[]> {
  const out: HeliusTx[] = [];
  let before = '';
  for (let page = 0; page < 50; page++) {
    // hard cap 5000 tx
    const url =
      `https://api.helius.xyz/v0/addresses/${addr}/transactions` +
      `?api-key=${KEY}&limit=100${before ? `&before=${before}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Helius ${res.status}: ${await res.text()}`);
    const batch = (await res.json()) as HeliusTx[];
    if (!batch.length) break;
    out.push(...batch);
    before = batch[batch.length - 1]!.signature;
    if (batch.length < 100) break;
  }
  return out;
}

// Net change of a given mint for the wallet within one tx (UI amounts).
function tokenDelta(tx: HeliusTx, mint: string, wallet: string): number {
  let d = 0;
  for (const t of tx.tokenTransfers || []) {
    if (t.mint !== mint) continue;
    const amt = Number(t.tokenAmount) || 0;
    if (t.toUserAccount === wallet) d += amt;
    if (t.fromUserAccount === wallet) d -= amt;
  }
  return d;
}

// Net USD value-leg change for the wallet (SOL + stables) within one tx.
function valueDelta(tx: HeliusTx, wallet: string, ts: number): number {
  let usd = 0;
  // native SOL
  for (const n of tx.nativeTransfers || []) {
    const sol = (Number(n.amount) || 0) / 1e9;
    if (n.toUserAccount === wallet) usd += solToUsd(ts, sol);
    if (n.fromUserAccount === wallet) usd -= solToUsd(ts, sol);
  }
  // stablecoins (~$1)
  for (const t of tx.tokenTransfers || []) {
    if (!t.mint || !STABLES.has(t.mint)) continue;
    const amt = Number(t.tokenAmount) || 0;
    if (t.toUserAccount === wallet) usd += amt;
    if (t.fromUserAccount === wallet) usd -= amt;
  }
  return usd;
}

function classify(tx: HeliusTx, mint: string, wallet: string): PositionEvent | null {
  const td = tokenDelta(tx, mint, wallet);
  if (Math.abs(td) < EPS) return null; // tx doesn't move our token
  const vd = valueDelta(tx, wallet, tx.timestamp);
  const base = { ts: tx.timestamp, sig: tx.signature };
  if (td > 0 && vd < -EPS) return { kind: 'buy', amount: td, usd: -vd, ...base };
  if (td < 0 && vd > EPS) return { kind: 'sell', amount: -td, usd: vd, ...base };
  if (td > 0) return { kind: 'transfer_in', amount: td, ...base };
  return { kind: 'transfer_out', amount: -td, ...base };
}

async function main(): Promise<void> {
  console.log(
    `\nWallet ${WALLET}\nToken  ${MINT}\nSOL flat price $${FLAT_SOL} (see NOTE)\nFetching from Helius...\n`,
  );
  const txs = await fetchAll(WALLET!);
  console.log(`${txs.length} txs pulled. Building events...\n`);

  const events = txs
    .map((tx) => classify(tx, MINT!, WALLET!))
    .filter((e): e is PositionEvent => e !== null)
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0)); // oldest -> newest

  if (!events.length) {
    console.log('No activity for this token in this wallet.');
    return;
  }

  const r = computeAverageCost(events);
  const f = computeFIFO(events);

  const dt = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' ');
  console.log('LEDGER (verify against Solscan):');
  for (const e of r.ledger) {
    const tag = e.kind.toUpperCase().padEnd(12);
    const amt = e.amount.toLocaleString('en-US', { maximumFractionDigits: 2 }).padStart(16);
    const usd = e.usd != null ? ('$' + Math.round(e.usd).toLocaleString()).padStart(14) : ''.padStart(14);
    const rz = e.realized ? `  realized ${e.realized >= 0 ? '+' : ''}$${Math.round(e.realized).toLocaleString()}` : '';
    console.log(`  ${dt(e.ts ?? 0)}  ${tag}${amt}${usd}  ${e.sig?.slice(0, 8)}…${rz}`);
  }

  console.log('\nSUMMARY (average cost):');
  console.log(`  Realized PnL        ${r.realizedPnL >= 0 ? '+' : ''}$${r.realizedPnL.toLocaleString()}`);
  console.log(`  Proceeds            $${r.totalProceeds.toLocaleString()}`);
  console.log(`  Cost of sold        $${r.costOfSold.toLocaleString()}`);
  console.log(`  Multiple on sold    ${r.multipleOnSold ?? '—'}×`);
  console.log(
    `  Still holding       ${r.tokensRemaining.toLocaleString()} tokens (cost basis $${r.costBasisRemaining.toLocaleString()})`,
  );
  console.log(`  FIFO realized (cmp) ${f.realizedPnL >= 0 ? '+' : ''}$${f.realizedPnL.toLocaleString()}`);

  if (r.warnings.length) {
    console.log('\nWARNINGS (accuracy caveats — read these):');
    for (const w of r.warnings) console.log('  • ' + w);
  }
  console.log('');
}

main().catch((e: unknown) => {
  console.error('ERROR:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
