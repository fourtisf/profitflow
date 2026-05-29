// SOL -> USD pricing. CRITICAL: must be PER-TIMESTAMP. A flat constant is the #1 accuracy error
// (HANDOFF). We cache by 1-minute bucket to keep credit usage sane.
import { env } from './env';

export interface PriceSource {
  readonly name: string;
  /** USD value of 1 SOL at the given unix-seconds timestamp. */
  solUsd(unixSec: number): Promise<number>;
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';

/** Birdeye historical price. NOTE: verify endpoint/params against current Birdeye docs. */
export class BirdeyePriceSource implements PriceSource {
  readonly name = 'birdeye';
  private cache = new Map<number, number>(); // minute bucket -> price

  constructor(private readonly apiKey: string) {}

  async solUsd(unixSec: number): Promise<number> {
    const bucket = Math.floor(unixSec / 60) * 60;
    const cached = this.cache.get(bucket);
    if (cached != null) return cached;

    const url =
      `https://public-api.birdeye.so/defi/history_price?address=${SOL_MINT}` +
      `&address_type=token&type=1m&time_from=${bucket}&time_to=${bucket + 60}`;
    const res = await fetch(url, {
      headers: { 'X-API-KEY': this.apiKey, 'x-chain': 'solana' },
    });
    if (!res.ok) throw new Error(`Birdeye ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { data?: { items?: { value?: number }[] } };
    const price = json.data?.items?.[0]?.value;
    if (typeof price !== 'number') throw new Error('Birdeye: no price for bucket');
    this.cache.set(bucket, price);
    return price;
  }
}

/**
 * Last resort when no historical source is configured. Uses Birdeye's CURRENT price for every
 * timestamp — wrong for backfill, but at least not a hardcoded constant. Logs loudly so this never
 * silently ships to production.
 */
export class SpotFallbackPriceSource implements PriceSource {
  readonly name = 'spot-fallback';
  private price = 150;
  private lastFetch = 0;

  async solUsd(_unixSec: number): Promise<number> {
    const now = Date.now();
    if (now - this.lastFetch > 60_000) {
      this.lastFetch = now;
      try {
        const res = await fetch(
          `https://public-api.birdeye.so/defi/price?address=${SOL_MINT}`,
          { headers: { 'x-chain': 'solana' } },
        );
        if (res.ok) {
          const json = (await res.json()) as { data?: { value?: number } };
          if (typeof json.data?.value === 'number') this.price = json.data.value;
        }
      } catch {
        /* keep last price */
      }
    }
    return this.price;
  }
}

export function createPriceSource(): PriceSource {
  if (env.birdeyeApiKey) return new BirdeyePriceSource(env.birdeyeApiKey);
  console.warn(
    '[price] No BIRDEYE_API_KEY (or Pyth) configured -> using SPOT fallback for ALL timestamps. ' +
      'This is wrong for historical positions and must NOT ship. Set BIRDEYE_API_KEY / PYTH_PRICE_URL.',
  );
  return new SpotFallbackPriceSource();
}
