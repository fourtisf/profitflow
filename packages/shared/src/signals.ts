import type { RealizedExit } from './types';

/**
 * Smart-money "cluster exit" signal: several DISTINCT wallets cashing out the SAME token
 * inside a short window — i.e. coordinated distribution / a top getting dumped. Pure and
 * side-effect free so it's unit-testable and reusable on both the API and the web pages.
 */
export interface ClusterSignal {
  mint: string;
  ticker: string;
  wallets: number; // distinct wallets that exited inside the window
  exits: number; // total exits inside the window
  realizedUsd: number; // total realized PnL pulled out inside the window
  windowMs: number; // the window the signal was computed over
  lastTs: number; // most recent exit in the cluster
}

export interface ClusterOptions {
  /** How recent the exits must be to count toward a cluster. Default 6h. */
  windowMs?: number;
  /** Minimum distinct wallets required to call it a cluster. Default 3. */
  minWallets?: number;
  /** Clock injection for deterministic tests. Default Date.now(). */
  now?: number;
}

const SIX_HOURS = 6 * 60 * 60 * 1000;

export function detectClusterExits(exits: RealizedExit[], opts: ClusterOptions = {}): ClusterSignal[] {
  const windowMs = opts.windowMs ?? SIX_HOURS;
  const minWallets = opts.minWallets ?? 3;
  const since = (opts.now ?? Date.now()) - windowMs;

  interface Agg {
    ticker: string;
    wallets: Set<string>;
    exits: number;
    realizedUsd: number;
    lastTs: number;
  }
  const byMint = new Map<string, Agg>();

  for (const e of exits) {
    if (e.ts < since) continue;
    let agg = byMint.get(e.mint);
    if (!agg) {
      agg = { ticker: e.ticker, wallets: new Set(), exits: 0, realizedUsd: 0, lastTs: 0 };
      byMint.set(e.mint, agg);
    }
    agg.wallets.add(e.wallet);
    agg.exits += 1;
    agg.realizedUsd += e.pnlUsd;
    if (e.ts > agg.lastTs) agg.lastTs = e.ts;
  }

  const signals: ClusterSignal[] = [];
  for (const [mint, agg] of byMint) {
    if (agg.wallets.size < minWallets) continue;
    signals.push({
      mint,
      ticker: agg.ticker,
      wallets: agg.wallets.size,
      exits: agg.exits,
      realizedUsd: Math.round(agg.realizedUsd),
      windowMs,
      lastTs: agg.lastTs,
    });
  }
  // Strongest signal first: more wallets, then more dollars pulled out.
  signals.sort((a, b) => b.wallets - a.wallets || b.realizedUsd - a.realizedUsd);
  return signals;
}
