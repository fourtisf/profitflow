// Parse a Helius enhanced transaction into per-mint token deltas + the wallet's value legs
// (SOL lamports + stablecoin USD). Mirrors the validated validate.js classifier. USD pricing of
// the SOL leg happens in the pipeline (per-timestamp), not here.

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const SOL = 'So11111111111111111111111111111111111111112';
const STABLES = new Set([USDC, USDT]);
const SKIP_MINTS = new Set([USDC, USDT, SOL]);
const EPS = 1e-9;

export interface HeliusTransfer {
  mint?: string;
  tokenAmount?: number | string;
  amount?: number | string;
  fromUserAccount?: string;
  toUserAccount?: string;
}
export interface HeliusTx {
  signature: string;
  timestamp: number;
  source?: string; // e.g. PUMP_FUN, RAYDIUM, METEORA
  type?: string;
  tokenTransfers?: HeliusTransfer[];
  nativeTransfers?: HeliusTransfer[];
}

export interface TxLegs {
  ts: number;
  sig: string;
  /** Net SOL the wallet received(+)/paid(-), in lamports. */
  solLamports: number;
  /** Net stablecoin USD the wallet received(+)/paid(-). */
  stableUsd: number;
  /** Per non-SOL/non-stable mint: net token delta for the wallet. */
  mints: Map<string, number>;
}

export function extractLegs(tx: HeliusTx, wallet: string): TxLegs {
  let solLamports = 0;
  let stableUsd = 0;
  const mints = new Map<string, number>();

  for (const n of tx.nativeTransfers ?? []) {
    const lamports = Number(n.amount) || 0;
    if (n.toUserAccount === wallet) solLamports += lamports;
    if (n.fromUserAccount === wallet) solLamports -= lamports;
  }

  for (const t of tx.tokenTransfers ?? []) {
    if (!t.mint) continue;
    const amt = Number(t.tokenAmount) || 0;
    if (STABLES.has(t.mint)) {
      if (t.toUserAccount === wallet) stableUsd += amt;
      if (t.fromUserAccount === wallet) stableUsd -= amt;
      continue;
    }
    if (SKIP_MINTS.has(t.mint)) continue;
    let delta = mints.get(t.mint) ?? 0;
    if (t.toUserAccount === wallet) delta += amt;
    if (t.fromUserAccount === wallet) delta -= amt;
    mints.set(t.mint, delta);
  }

  // drop dust
  for (const [mint, d] of mints) if (Math.abs(d) < EPS) mints.delete(mint);

  return { ts: tx.timestamp, sig: tx.signature, solLamports, stableUsd, mints };
}

export const EPSILON = EPS;
