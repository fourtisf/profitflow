import type { Tier } from './config';

/** Venues we display (HANDOFF locked decision #4). */
export type Source = 'pump.fun' | 'Raydium' | 'Meteora';

/**
 * The core domain object: one wallet's realized cash-out of one token, the moment it clears.
 * Shape is identical whether it came from `sim` or `helius` — the frontend never knows which.
 */
export interface RealizedExit {
  /** Dedupe key (tx signature). Idempotent emission keys on this. */
  id: string;
  sig: string;
  /** Unix ms when the sell cleared. */
  ts: number;
  ticker: string; // "$GIGA"
  mint: string;
  wallet: string; // full address
  walletShort: string; // "Kd4m…8sQe"
  /** Cost basis of the sold tokens (0 + unverifiedBasis=true when basis is unknown). */
  entryUsd: number;
  proceedsUsd: number;
  pnlUsd: number; // realized PnL (average cost)
  /** proceeds / cost. null when basis is unknown (never render a fake "+∞×"). */
  multiple: number | null;
  source: Source;
  /** transfer_in trap: tokens arrived with unknown basis. Show "unverified basis", hide multiple. */
  unverifiedBasis: boolean;
  /** Which tier first sees this exit (free >= $10k, else pro). */
  tier: Tier;
}

export type LeaderboardRange = 'week' | 'all';

export interface LeaderboardEntry {
  wallet: string;
  walletShort: string;
  realizedUsd: number;
  exits: number;
  bestMultiple: number | null;
  topTicker: string;
  topExitUsd: number;
}

export interface WalletProfile {
  wallet: string;
  walletShort: string;
  realizedUsd: number;
  bestMultiple: number | null;
  firstSeen: number;
  lastSeen: number;
  exits: RealizedExit[];
}

/** One token's realized cash-outs across every wallet we've seen exit it. */
export interface TokenProfile {
  mint: string;
  ticker: string;
  realizedUsd: number; // total realized PnL across all exits of this token
  exitsCount: number;
  walletsCount: number; // distinct wallets that cashed out
  bestMultiple: number | null;
  topExitUsd: number;
  firstSeen: number;
  lastSeen: number;
  exits: RealizedExit[];
}

// ── WebSocket protocol (api <-> web) ─────────────────────────────────────────
export type WsServerMessage =
  | { type: 'hello'; recent: RealizedExit[]; tier: Tier; serverTime: number }
  | { type: 'exit'; exit: RealizedExit }
  | { type: 'ping'; t: number };

export type WsClientMessage =
  | { type: 'pong'; t?: number }
  | { type: 'setTier'; tier: Tier };
