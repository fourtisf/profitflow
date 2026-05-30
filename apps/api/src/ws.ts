import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { DataSource, RealizedExit, Tier, WsServerMessage } from '@profitflow/shared';

// Production-grade feed: heartbeat (drop dead clients), per-client backpressure cap, tier gating.
// The client owns reconnect + a capped render buffer (see apps/web).

const MAX_BUFFERED_BYTES = 1_000_000; // 1MB: if a client can't keep up, drop rather than grow
const HEARTBEAT_MS = 30_000;

interface AliveSocket extends WebSocket {
  isAlive?: boolean;
}

export function attachWebSocket(server: Server, ds: DataSource): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  function send(ws: WebSocket, msg: WsServerMessage): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > MAX_BUFFERED_BYTES) return; // backpressure: drop this frame
    ws.send(JSON.stringify(msg));
  }

  wss.on('connection', (socket: WebSocket, req) => {
    const ws = socket as AliveSocket;
    const url = new URL(req.url ?? '/ws', 'http://localhost');
    let tier: Tier = url.searchParams.get('tier') === 'pro' ? 'pro' : 'free';

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    send(ws, { type: 'hello', recent: ds.getRecent({ tier, limit: 50 }), tier, serverTime: Date.now() });

    const unsubscribe = ds.onExit((exit: RealizedExit) => {
      if (tier === 'free' && exit.tier !== 'free') return; // gate Pro-only exits
      send(ws, { type: 'exit', exit });
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string; tier?: string };
        if (msg.type === 'setTier') tier = msg.tier === 'pro' ? 'pro' : 'free';
      } catch {
        /* ignore malformed client messages */
      }
    });

    ws.on('close', unsubscribe);
    ws.on('error', unsubscribe);
  });

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const ws = client as AliveSocket;
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        /* ignore */
      }
    }
  }, HEARTBEAT_MS);

  wss.on('close', () => clearInterval(heartbeat));
  return wss;
}
