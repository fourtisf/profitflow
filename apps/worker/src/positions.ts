// Running cost basis per wallet×token, kept in Redis (hot) so a sell's realized PnL is instant.
// The MATH is delegated to the engine unchanged: we keep the event list per position and re-run
// computeAverageCost, reading the just-applied event's realized PnL from the last ledger entry.
// (Lists are capped; bounded universe keeps this cheap.) In-memory fallback when no Redis.
import { computeAverageCost, type PositionEvent } from '@profitflow/pnl-engine';
import type { Redis } from 'ioredis';

const MAX_EVENTS_PER_POSITION = 1000;

export interface AppliedResult {
  realizedThisEvent: number;
  entryUsd: number; // cost basis of the tokens sold in this event
  proceedsUsd: number;
  multiple: number | null;
  tokensRemaining: number;
  unverifiedBasis: boolean;
}

export class PositionStore {
  private mem = new Map<string, PositionEvent[]>();

  constructor(private readonly redis: Redis | null) {}

  private key(wallet: string, mint: string): string {
    return `pf:pos:${wallet}:${mint}`;
  }

  private async load(key: string): Promise<PositionEvent[]> {
    if (!this.redis) return this.mem.get(key) ?? [];
    const raw = await this.redis.lrange(key, 0, -1);
    return raw.map((s) => JSON.parse(s) as PositionEvent);
  }

  private async append(key: string, event: PositionEvent): Promise<void> {
    if (!this.redis) {
      const list = this.mem.get(key) ?? [];
      list.push(event);
      if (list.length > MAX_EVENTS_PER_POSITION) list.splice(0, list.length - MAX_EVENTS_PER_POSITION);
      this.mem.set(key, list);
      return;
    }
    await this.redis.rpush(key, JSON.stringify(event));
    await this.redis.ltrim(key, -MAX_EVENTS_PER_POSITION, -1);
  }

  /** Apply one event to a position and return the realized PnL it produced (0 for non-sells). */
  async apply(wallet: string, mint: string, event: PositionEvent): Promise<AppliedResult> {
    const key = this.key(wallet, mint);
    await this.append(key, event);
    const events = await this.load(key);
    const r = computeAverageCost(events);
    const last = r.ledger[r.ledger.length - 1];
    const unverifiedBasis = r.warnings.some((w) => w.includes('transfer_in'));

    if (event.kind !== 'sell' || !last) {
      return {
        realizedThisEvent: 0,
        entryUsd: 0,
        proceedsUsd: 0,
        multiple: null,
        tokensRemaining: r.tokensRemaining,
        unverifiedBasis,
      };
    }

    const entryUsd = last.costOfThisSell ?? 0;
    const proceedsUsd = event.usd ?? 0;
    return {
      realizedThisEvent: last.realized,
      entryUsd: unverifiedBasis ? 0 : entryUsd,
      proceedsUsd,
      multiple: unverifiedBasis || entryUsd <= 0 ? null : Number((proceedsUsd / entryUsd).toFixed(2)),
      tokensRemaining: r.tokensRemaining,
      unverifiedBasis,
    };
  }
}
