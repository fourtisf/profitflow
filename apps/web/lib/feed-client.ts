import { SimDataSource, type RealizedExit, type Tier } from '@profitflow/shared';

export type FeedStatus = 'connecting' | 'live' | 'reconnecting' | 'demo';

export interface FeedHandlers {
  onHello?: (recent: RealizedExit[]) => void;
  onExit: (exit: RealizedExit) => void;
  onAlert?: (exit: RealizedExit) => void; // a followed wallet just cashed out
  onStatus?: (status: FeedStatus) => void;
}

function shortWallet(w: string): string {
  return w.length > 8 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w;
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

  private follows: string[] = [];

  constructor(
    private readonly url: string | undefined,
    private readonly handlers: FeedHandlers,
    private readonly tier: Tier = 'free',
    follows: string[] = [],
  ) {
    this.follows = follows;
  }

  /** Update the followed-wallet set; pushes it to the server if connected. */
  setFollows(wallets: string[]): void {
    this.follows = wallets;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'setFollows', wallets }));
    }
  }

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
        if (this.follows.length) ws.send(JSON.stringify({ type: 'setFollows', wallets: this.follows }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as
            | { type: 'hello'; recent: RealizedExit[] }
            | { type: 'exit'; exit: RealizedExit }
            | { type: 'alert'; exit: RealizedExit }
            | { type: string };
          if (msg.type === 'hello') this.handlers.onHello?.((msg as { recent: RealizedExit[] }).recent);
          else if (msg.type === 'exit') this.handlers.onExit((msg as { exit: RealizedExit }).exit);
          else if (msg.type === 'alert') this.handlers.onAlert?.((msg as { exit: RealizedExit }).exit);
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
      // Demo: occasionally re-attribute an exit to a followed wallet so alerts are visible.
      if (this.follows.length && this.handlers.onAlert && Math.random() < 0.3) {
        const w = this.follows[Math.floor(Math.random() * this.follows.length)]!;
        this.handlers.onAlert({ ...exit, wallet: w, walletShort: shortWallet(w) });
        return;
      }
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
