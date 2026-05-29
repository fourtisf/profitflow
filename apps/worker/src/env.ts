import { config } from '@profitflow/shared';

export const env = {
  dataSource: (process.env.DATA_SOURCE ?? 'sim') as 'sim' | 'helius',
  heliusApiKey: process.env.HELIUS_API_KEY,
  birdeyeApiKey: process.env.BIRDEYE_API_KEY,
  pythPriceUrl: process.env.PYTH_PRICE_URL,
  redisUrl: process.env.REDIS_URL,
  databaseUrl: process.env.DATABASE_URL,
  redisChannel: process.env.REDIS_EXITS_CHANNEL ?? 'profitflow:exits',
  webhookPort: Number(process.env.WORKER_WEBHOOK_PORT ?? 4100),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 15_000),
  watchAddresses: (process.env.WATCH_ADDRESSES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  universeFloorUsd: config.universeLiquidityFloorUsd,
};
