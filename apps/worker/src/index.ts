import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { SimDataSource } from '@profitflow/shared';
import { Emitter } from './emit';
import { env } from './env';
import { HeliusIngest } from './ingest';
import { PositionStore } from './positions';
import { createPriceSource } from './price';
import { Universe } from './universe';

async function connectRedis(): Promise<Redis | null> {
  if (!env.redisUrl) return null;
  const r = new Redis(env.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
  r.on('error', (e) => console.error('[worker] redis error:', e.message));
  try {
    await r.connect();
  } catch (e) {
    console.error('[worker] redis connect failed (continuing):', e instanceof Error ? e.message : String(e));
  }
  return r;
}

async function main(): Promise<void> {
  const pool = env.databaseUrl ? new Pool({ connectionString: env.databaseUrl, max: 4 }) : null;
  const redisPub = await connectRedis();
  const redisState = await connectRedis();
  const emitter = new Emitter(pool, redisPub);

  let ingest: HeliusIngest | null = null;
  let sim: SimDataSource | null = null;

  if (env.dataSource === 'helius' && env.heliusApiKey) {
    const price = createPriceSource();
    const positions = new PositionStore(redisState);
    const universe = new Universe(env.universeFloorUsd);
    await universe.refresh();
    ingest = new HeliusIngest({ price, positions, emitter, universe });
    ingest.startWebhook();
    ingest.startPolling();
    console.log(
      `[worker] helius ingest live (price=${price.name}, ${env.watchAddresses.length} watched wallets)`,
    );
  } else {
    console.log(
      '[worker] DATA_SOURCE != helius (or no HELIUS_API_KEY) -> SIM DRY-RUN: piping simulated exits ' +
        'through the real emit path (Postgres/Redis if configured, else logged).',
    );
    sim = new SimDataSource({ intervalMs: [2000, 5000] });
    sim.onExit((exit) => void emitter.emit(exit));
    await sim.start();
  }

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[worker] ${signal} -> shutting down`);
    await sim?.stop();
    await ingest?.stop();
    await emitter.close();
    try {
      await redisState?.quit();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
