import http from 'node:http';
import { createDataSource } from './datasource';
import { env } from './env';
import { createApp } from './http';
import { attachWebSocket } from './ws';

async function main(): Promise<void> {
  const ds = createDataSource();
  await ds.start();

  const app = createApp(ds);
  const server = http.createServer(app);
  attachWebSocket(server, ds);

  server.listen(env.port, () => {
    console.log(`[api] listening on :${env.port}  (source=${ds.name})`);
    console.log(`[api]   REST  http://localhost:${env.port}/health`);
    console.log(`[api]   WS    ws://localhost:${env.port}/ws`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[api] ${signal} received -> shutting down`);
    server.close();
    await ds.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
