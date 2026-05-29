// Central, env-overridable thresholds. Read once; safe in both Node and the browser.
// (In the browser `process` is undefined — we guard, and just use the defaults.)

function envNum(key: string, fallback: number): number {
  const raw = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  /** Emit a realized-profit event once a sell's realized PnL clears this (Pro tier floor). */
  proMinUsd: envNum('PRO_MIN_USD', 500),
  /** The free, public feed only shows exits at or above this. */
  freeMinUsd: envNum('FREE_MIN_USD', 10_000),
  /** Bounded universe: only track tokens with at least this much liquidity (M3 worker). */
  universeLiquidityFloorUsd: envNum('UNIVERSE_LIQUIDITY_FLOOR_USD', 50_000),
} as const;

export type Tier = 'free' | 'pro';

/** Which tier first sees an exit of this size. >= freeMin is public; smaller is Pro-only. */
export function tierFor(pnlUsd: number): Tier {
  return pnlUsd >= config.freeMinUsd ? 'free' : 'pro';
}
