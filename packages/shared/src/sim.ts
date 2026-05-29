import { computeAverageCost, type PositionEvent } from '@profitflow/pnl-engine';
import { BaseDataSource } from './datasource.js';
import { config, tierFor } from './config.js';
import { shortWallet } from './format.js';
import type { RealizedExit, Source } from './types.js';

// Ported from the approved landing page's simulator, but routed through the REAL engine so the
// numbers (and the transfer_in / unverified-basis trap) behave exactly like live data will.

const TOKENS = [
  '$WIF', '$POPCAT', '$MOODENG', '$GIGA', '$PNUT', '$BONK', '$MEW',
  '$FWOG', '$GOAT', '$ZEREBRO', '$AI16Z', '$CHILLGUY', '$PONKE',
];
const SOURCES: Source[] = ['pump.fun', 'Raydium', 'Meteora'];
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function randB58(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += B58[Math.floor(Math.random() * B58.length)];
  return s;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export interface SimOptions {
  /** [min, max] ms between emitted exits. */
  intervalMs?: [number, number];
}

export class SimDataSource extends BaseDataSource {
  readonly name = 'sim';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly intervalMs: [number, number];

  constructor(opts: SimOptions = {}) {
    super(1000);
    this.intervalMs = opts.intervalMs ?? [1600, 4000];
  }

  async start(): Promise<void> {
    if (this.timer) return; // already running
    // Seed so the feed is alive on first connect (oldest -> newest).
    for (let i = 8; i >= 1; i--) this.publish(this.generate(Date.now() - i * 7000));
    this.loop();
  }

  async stop(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private loop = (): void => {
    this.publish(this.generate(Date.now()));
    const [lo, hi] = this.intervalMs;
    this.timer = setTimeout(this.loop, lo + Math.random() * (hi - lo));
  };

  /** Generate one realistic exit by running synthetic events through the real engine. */
  generate(ts: number = Date.now()): RealizedExit {
    const big = Math.random() < 0.16;
    const ticker = pick(TOKENS);
    const wallet = randB58(44);
    const sig = randB58(64);
    const amount = 1_000 + Math.random() * 9_000_000;
    const flagged = Math.random() < 0.08; // transfer_in -> "unverified basis"

    const pnlTarget = big ? 80_000 + Math.random() * 700_000 : config.proMinUsd + Math.random() * 48_000;
    const mult = big ? 12 + Math.random() * 180 : 1.4 + Math.random() * 18;
    const entry = pnlTarget / (mult - 1);
    const proceeds = entry + pnlTarget;

    const events: PositionEvent[] = flagged
      ? [
          { kind: 'transfer_in', amount, sig },
          { kind: 'sell', amount, usd: proceeds, sig },
        ]
      : [
          { kind: 'buy', amount, usd: entry, sig },
          { kind: 'sell', amount, usd: proceeds, sig },
        ];

    const r = computeAverageCost(events);
    const unverifiedBasis = r.warnings.some((w) => w.includes('transfer_in'));
    const pnlUsd = r.realizedPnL;

    return {
      id: sig,
      sig,
      ts,
      ticker,
      mint: randB58(44),
      wallet,
      walletShort: shortWallet(wallet),
      entryUsd: unverifiedBasis ? 0 : Math.round(entry),
      proceedsUsd: Math.round(proceeds),
      pnlUsd: Math.round(pnlUsd),
      multiple: r.multipleOnSold, // null when basis unknown -> never a fake "+∞×"
      source: pick(SOURCES),
      unverifiedBasis,
      tier: tierFor(pnlUsd),
    };
  }
}
