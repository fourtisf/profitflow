import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { BaseDataSource, SimDataSource, type DataSource, type RealizedExit, type Source, type Tier } from '@profitflow/shared';
import { env } from './env.js';

/**
 * Live source for `DATA_SOURCE=helius`. The worker (M3) is the producer: it ingests from Helius,
 * runs the engine, writes emitted events to Postgres, and publishes them on a Redis channel.
 * This source READS that: backfills recent rows from Postgres, then live-tails the Redis channel.
 *
 * Graceful degradation (HANDOFF / prompt requirement): if REDIS_URL / DATABASE_URL are missing or
 * error, we log and keep serving whatever we have — we never crash the API.
 */
interface EventRow {
  sig: string;
  ts: string | number; // unix ms
  ticker: string;
  mint: string;
  wallet: string;
  wallet_short: string;
  entry_usd: string | number;
  proceeds_usd: string | number;
  pnl_usd: string | number;
  multiple: string | number | null;
  source: string;
  unverified_basis: boolean;
  tier: string;
}

function rowToExit(r: EventRow): RealizedExit {
  return {
    id: r.sig,
    sig: r.sig,
    ts: Number(r.ts),
    ticker: r.ticker,
    mint: r.mint,
    wallet: r.wallet,
    walletShort: r.wallet_short,
    entryUsd: Number(r.entry_usd),
    proceedsUsd: Number(r.proceeds_usd),
    pnlUsd: Number(r.pnl_usd),
    multiple: r.multiple == null ? null : Number(r.multiple),
    source: r.source as Source,
    unverifiedBasis: Boolean(r.unverified_basis),
    tier: r.tier as Tier,
  };
}

export class LiveDataSource extends BaseDataSource {
  readonly name = 'helius';
  private redis: Redis | null = null;
  private pool: Pool | null = null;

  async start(): Promise<void> {
    if (!env.redisUrl && !env.databaseUrl) {
      console.warn(
        '[datasource] DATA_SOURCE=helius but neither REDIS_URL nor DATABASE_URL is set. ' +
          'Serving an empty feed. Start apps/worker and set these to go live.',
      );
      return;
    }

    // 1) Backfill recent emitted events from Postgres.
    if (env.databaseUrl) {
      try {
        this.pool = new Pool({ connectionString: env.databaseUrl, max: 4 });
        const { rows } = await this.pool.query<EventRow>(
          'SELECT sig, ts, ticker, mint, wallet, wallet_short, entry_usd, proceeds_usd, pnl_usd, multiple, source, unverified_basis, tier FROM pf_events ORDER BY ts DESC LIMIT 200',
        );
        for (const row of rows.reverse()) this.publish(rowToExit(row)); // oldest -> newest
        console.log(`[datasource] backfilled ${rows.length} events from Postgres`);
      } catch (err) {
        console.error('[datasource] Postgres backfill failed (continuing):', errMsg(err));
      }
    }

    // 2) Live-tail the worker's Redis channel.
    if (env.redisUrl) {
      try {
        this.redis = new Redis(env.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
        this.redis.on('error', (e) => console.error('[datasource] redis error:', errMsg(e)));
        await this.redis.connect();
        await this.redis.subscribe(env.redisChannel);
        this.redis.on('message', (_channel, message) => {
          try {
            this.publish(rowToExit(JSON.parse(message) as EventRow));
          } catch (err) {
            console.error('[datasource] bad redis message (skipped):', errMsg(err));
          }
        });
        console.log(`[datasource] subscribed to redis channel "${env.redisChannel}"`);
      } catch (err) {
        console.error('[datasource] Redis subscribe failed (continuing):', errMsg(err));
      }
    }
  }

  async stop(): Promise<void> {
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
    this.redis = null;
    this.pool = null;
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The one place demo vs live is chosen. Everything downstream is identical. */
export function createDataSource(): DataSource {
  if (env.dataSource === 'helius') return new LiveDataSource();
  return new SimDataSource();
}
