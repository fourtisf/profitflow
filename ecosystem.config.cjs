// pm2 process file for the ProfitFlow backend (api + worker + bot).
// Build first, then: pm2 start ecosystem.config.cjs && pm2 save
//
//   corepack enable
//   pnpm install --frozen-lockfile
//   pnpm --filter @profitflow/api --filter @profitflow/worker --filter @profitflow/bot build
//   pm2 start ecosystem.config.cjs && pm2 save
//
// Defaults to demo (sim) mode — no keys/DB needed. To go live, set the env values below
// (DATA_SOURCE=helius + HELIUS_API_KEY + BIRDEYE_API_KEY + DATABASE_URL + REDIS_URL + bot creds).
module.exports = {
  apps: [
    {
      name: 'profitflow-api',
      cwd: __dirname,
      script: 'apps/api/dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
        DATA_SOURCE: 'sim', // -> 'helius' to read real events from Postgres/Redis
        CORS_ORIGIN: '*', // -> your web origin in production
        // DATABASE_URL: 'postgresql://user:pass@localhost:5432/profitflow',
        // REDIS_URL: 'redis://localhost:6379',
      },
    },
    {
      name: 'profitflow-worker',
      cwd: __dirname,
      script: 'apps/worker/dist/index.js',
      env: {
        NODE_ENV: 'production',
        DATA_SOURCE: 'sim', // -> 'helius' for real ingest
        // HELIUS_API_KEY: '',
        // BIRDEYE_API_KEY: '',
        // DATABASE_URL: 'postgresql://user:pass@localhost:5432/profitflow',
        // REDIS_URL: 'redis://localhost:6379',
      },
    },
    {
      name: 'profitflow-bot',
      cwd: __dirname,
      script: 'apps/bot/dist/index.js',
      env: {
        NODE_ENV: 'production',
        API_URL: 'http://localhost:4000',
        // SITE_URL: 'https://exitradar.fun',
        // TELEGRAM_BOT_TOKEN: '',
        // TELEGRAM_CHAT_ID: '',
      },
    },
  ],
};
