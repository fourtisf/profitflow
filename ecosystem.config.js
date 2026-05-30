// PM2 process definitions for ProfitFlow.
//
// IMPORTANT — read before running:
// This file intentionally manages ONLY the app(s) contained in THIS repository.
// The production services already running on the server —
//     gateway, ingest, enrich, payments, bot, alerts, web
// are NOT defined here and MUST NOT be deleted. Always start/reload with the
// `--only` flag so PM2 never touches anything else:
//
//     pm2 start ecosystem.config.js --only profitflow-landing
//
// `profitflow-landing` serves the static marketing page via a zero-dependency
// Node server (deploy/static-server.js). That page uses SIMULATED data — it is
// a demo, not the live product (see HANDOFF.md). Put it behind your existing
// reverse proxy, or set HOST=127.0.0.1 to keep it internal.

module.exports = {
  apps: [
    {
      name: 'profitflow-landing',
      script: 'deploy/static-server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '128M',
      time: true,
      env: {
        HOST: '0.0.0.0',
        PORT: 8080,
        STATIC_DIR: 'landing-page',
      },
    },
  ],
};
