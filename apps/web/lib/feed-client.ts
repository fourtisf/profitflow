import { SimDataSource, type RealizedExit, type Tier } from '@profitflow/shared';

export type FeedStatus = 'connecting' | 'live' | 'reconnecting' | 'demo';

export interface FeedHandlers {
  onHello?: (recent: RealizedExit[]) => void;
  onExit: (exit: RealizedExit) => void;
  onStatus?: (status: FeedStatus) => void;
}

/**
 * Browser feed client. Prefers the API WebSocket (with exponential-backoff reconnect); if no URL
 * is configured, or the socket can't be reached after a few tries, it falls back to an in-browser
 * SimDataSource so the page always looks alive ("demo" mode). The UI never knows which is active.
 */
export class FeedClient {
  private ws: WebSocket | null = null;
  private sim: SimDataSource | null = null;
  private simUnsub: (() => void) | null = null;
  private attempts = 0;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly url: string | undefined,
    private readonly handlers: FeedHandlers,
    private readonly tier: Tier = 'free',
  ) {}

  start(): void {
    if (!this.url) {
      this.startSim();
      return;
    }
    this.connect();
  }

  private connect(): void {
    this.handlers.onStatus?.(this.attempts === 0 ? 'connecting' : 'reconnecting');
    try {
      const ws = new WebSocket(`${this.url}?tier=${this.tier}`);
      this.ws = ws;
      ws.onopen = () => {
        this.attempts = 0;
        this.handlers.onStatus?.('live');
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as
            | { type: 'hello'; recent: RealizedExit[] }
            | { type: 'exit'; exit: RealizedExit }
            | { type: string };
          if (msg.type === 'hello') this.handlers.onHello?.((msg as { recent: RealizedExit[] }).recent);
          else if (msg.type === 'exit') this.handlers.onExit((msg as { exit: RealizedExit }).exit);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => this.scheduleReconnect();
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.sim) return;
    this.ws = null;
    this.attempts += 1;
    if (this.attempts >= 4) {
      this.startSim(); // give up on the socket -> demo mode
      return;
    }
    const delay = Math.min(1000 * 2 ** (this.attempts - 1), 8000);
    this.handlers.onStatus?.('reconnecting');
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startSim(): void {
    if (this.sim || this.stopped) return;
    this.handlers.onStatus?.('demo');
    const sim = new SimDataSource();
    this.sim = sim;
    void sim.start();
    this.handlers.onHello?.(sim.getRecent({ tier: this.tier, limit: 20 }));
    this.simUnsub = sim.onExit((exit) => {
      if (this.tier === 'free' && exit.tier !== 'free') return; // mirror live gating
      this.handlers.onExit(exit);
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.simUnsub?.();
    void this.sim?.stop();
    this.sim = null;
  }
}
