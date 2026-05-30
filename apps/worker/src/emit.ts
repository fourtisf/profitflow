// Emit a realized-profit event: idempotent insert into Postgres (pf_events) + publish on Redis
// for the API to live-tail. The Redis payload uses the snake_case row shape the API expects.
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import type { RealizedExit } from '@profitflow/shared';
import { env } from './env';

function toRow(e: RealizedExit) {
  return {
    sig: e.sig,
    ts: e.ts,
    ticker: e.ticker,
    mint: e.mint,
    wallet: e.wallet,
    wallet_short: e.walletShort,
    entry_usd: e.entryUsd,
    proceeds_usd: e.proceedsUsd,
    pnl_usd: e.pnlUsd,
    multiple: e.multiple,
    source: e.source,
    unverified_basis: e.unverifiedBasis,
    tier: e.tier,
  };
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export class Emitter {
  constructor(
    private readonly pool: Pool | null,
    private readonly redis: Redis | null,
  ) {}

  async emit(exit: RealizedExit): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO pf_events
             (sig, ts, ticker, mint, wallet, wallet_short, entry_usd, proceeds_usd, pnl_usd, multiple, source, unverified_basis, tier)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (sig) DO NOTHING`,
          [
            exit.sig, exit.ts, exit.ticker, exit.mint, exit.wallet, exit.walletShort,
            exit.entryUsd, exit.proceedsUsd, exit.pnlUsd, exit.multiple, exit.source,
            exit.unverifiedBasis, exit.tier,
          ],
        );
      } catch (e) {
        console.error('[emit] postgres insert failed (continuing):', msg(e));
      }
    }

    if (this.redis) {
      try {
        await this.redis.publish(env.redisChannel, JSON.stringify(toRow(exit)));
      } catch (e) {
        console.error('[emit] redis publish failed (continuing):', msg(e));
      }
    }

    console.log(
      `[emit] ${exit.ticker} +$${exit.pnlUsd.toLocaleString()} ${exit.walletShort} ` +
        `(${exit.source}${exit.unverifiedBasis ? ', unverified-basis' : ''}) tier=${exit.tier}` +
        `${this.pool || this.redis ? '' : ' [dry-run: no PG/Redis configured]'}`,
    );
  }

  async close(): Promise<void> {
    try {
      await this.redis?.quit();
    } catch {
      /* ignore */
    }
    try {
      await this.pool?.end();
    } catch {
      /* ignore */
    }
  }
}
