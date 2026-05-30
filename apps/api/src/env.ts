export const env = {
  port: Number(process.env.PORT ?? 4000),
  dataSource: (process.env.DATA_SOURCE ?? 'sim') as 'sim' | 'helius',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  redisUrl: process.env.REDIS_URL,
  databaseUrl: process.env.DATABASE_URL,
  /** Redis pub/sub channel the worker publishes emitted exits to. */
  redisChannel: process.env.REDIS_EXITS_CHANNEL ?? 'profitflow:exits',
};
