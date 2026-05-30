// PM2 process definitions for ProfitFlow.
//
// Two apps:
//   profitflow-landing — serves the static marketing page (deploy/static-server.js)
//   profitflow-api     — wallet realized-PnL API (pnl-validation/server.js)
//
// Start scoped with --only so PM2 never touches unrelated processes:
//   pm2 start ecosystem.config.js --only profitflow-landing
//   HELIUS_API_KEY=xxx pm2 start ecosystem.config.js --only profitflow-api --update-env
//
// The API needs HELIUS_API_KEY in its environment. NEVER hard-code the key here
// (this file is committed) — pass it on the shell when starting, as shown above.
// Both apps bind locally / sit behind nginx (see deploy/README.md).

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
    {
      name: 'profitflow-api',
      script: 'pnl-validation/server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '150M',
      time: true,
      env: {
        HOST: '127.0.0.1', // behind nginx; not exposed directly
        PORT: 8090,
        // HELIUS_API_KEY: provided on the shell at start time (see header) — do NOT commit it
      },
    },
  ],
};
