import { round } from '@profitflow/pnl-engine';
import type { Tier } from './config';
import { detectClusterExits, type ClusterOptions, type ClusterSignal } from './signals';
import type {
  LeaderboardEntry,
  LeaderboardRange,
  RealizedExit,
  TokenProfile,
  WalletProfile,
} from './types';

export type ExitListener = (exit: RealizedExit) => void;

/**
 * The single seam between demo and live. `apps/api` picks an implementation by `DATA_SOURCE`
 * env (`sim` | `helius`); everything downstream (REST, WebSocket, web) is identical regardless.
 */
export interface DataSource {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Subscribe to new exits as they clear. Returns an unsubscribe fn. */
  onExit(listener: ExitListener): () => void;
  getRecent(opts?: { limit?: number; tier?: Tier }): RealizedExit[];
  getLeaderboard(range: LeaderboardRange, limit?: number): LeaderboardEntry[];
  getWallet(wallet: string): WalletProfile | null;
  getToken(mint: string): TokenProfile | null;
  getSignals(opts?: ClusterOptions): ClusterSignal[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shared machinery for every DataSource: a newest-first ring buffer, idempotent publish
 * (dedupe by exit id), fan-out to listeners, and derived leaderboard / wallet views.
 * Concrete sources only implement ingestion and call `publish()`.
 */
export abstract class BaseDataSource implements DataSource {
  abstract readonly name: string;

  private readonly listeners = new Set<ExitListener>();
  protected buffer: RealizedExit[] = []; // newest first
  private readonly maxBuffer: number;

  constructor(maxBuffer = 1000) {
    this.maxBuffer = maxBuffer;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  onExit(listener: ExitListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Publish a new exit. Idempotent on `id`; safe against listener exceptions. */
  protected publish(exit: RealizedExit): void {
    if (this.buffer.some((e) => e.id === exit.id)) return; // dedupe by tx signature
    this.buffer.unshift(exit);
    if (this.buffer.length > this.maxBuffer) this.buffer.length = this.maxBuffer;
    for (const listener of this.listeners) {
      try {
        listener(exit);
      } catch {
        // one bad subscriber must not break the fan-out
      }
    }
  }

  getRecent(opts: { limit?: number; tier?: Tier } = {}): RealizedExit[] {
    const { limit = 50, tier = 'free' } = opts;
    const visible = tier === 'pro' ? this.buffer : this.buffer.filter((e) => e.tier === 'free');
    return visible.slice(0, Math.max(0, limit));
  }

  getLeaderboard(range: LeaderboardRange, limit = 20): LeaderboardEntry[] {
    const since = range === 'week' ? Date.now() - WEEK_MS : 0;
    const byWallet = new Map<string, LeaderboardEntry>();
    for (const e of this.buffer) {
      if (e.ts < since) continue;
      let agg = byWallet.get(e.wallet);
      if (!agg) {
        agg = {
          wallet: e.wallet,
          walletShort: e.walletShort,
          realizedUsd: 0,
          exits: 0,
          bestMultiple: null,
          topTicker: e.ticker,
          topExitUsd: 0,
        };
        byWallet.set(e.wallet, agg);
      }
      agg.realizedUsd += e.pnlUsd;
      agg.exits += 1;
      if (e.multiple != null && (agg.bestMultiple == null || e.multiple > agg.bestMultiple)) {
        agg.bestMultiple = e.multiple;
      }
      if (e.pnlUsd > agg.topExitUsd) {
        agg.topExitUsd = e.pnlUsd;
        agg.topTicker = e.ticker;
      }
    }
    return [...byWallet.values()]
      .map((a) => ({ ...a, realizedUsd: round(a.realizedUsd) }))
      .sort((a, b) => b.realizedUsd - a.realizedUsd)
      .slice(0, limit);
  }

  getWallet(wallet: string): WalletProfile | null {
    const exits = this.buffer.filter((e) => e.wallet === wallet);
    if (!exits.length) return null;
    const tss = exits.map((e) => e.ts);
    return {
      wallet,
      walletShort: exits[0]!.walletShort,
      realizedUsd: round(exits.reduce((s, e) => s + e.pnlUsd, 0)),
      bestMultiple: exits.reduce<number | null>(
        (m, e) => (e.multiple != null && (m == null || e.multiple > m) ? e.multiple : m),
        null,
      ),
      firstSeen: Math.min(...tss),
      lastSeen: Math.max(...tss),
      exits,
    };
  }

  getToken(mint: string): TokenProfile | null {
    const exits = this.buffer.filter((e) => e.mint === mint);
    if (!exits.length) return null;
    const tss = exits.map((e) => e.ts);
    const wallets = new Set(exits.map((e) => e.wallet));
    return {
      mint,
      ticker: exits[0]!.ticker,
      realizedUsd: round(exits.reduce((s, e) => s + e.pnlUsd, 0)),
      exitsCount: exits.length,
      walletsCount: wallets.size,
      bestMultiple: exits.reduce<number | null>(
        (m, e) => (e.multiple != null && (m == null || e.multiple > m) ? e.multiple : m),
        null,
      ),
      topExitUsd: round(exits.reduce((m, e) => Math.max(m, e.pnlUsd), 0)),
      firstSeen: Math.min(...tss),
      lastSeen: Math.max(...tss),
      exits,
    };
  }

  getSignals(opts?: ClusterOptions): ClusterSignal[] {
    return detectClusterExits(this.buffer, opts);
  }
}
