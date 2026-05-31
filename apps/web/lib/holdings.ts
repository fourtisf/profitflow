// Current portfolio of a wallet (SOL + tokens it still holds).
// Balances: Helius getAssetsByOwner. Prices: MULTI-SOURCE (Jupiter + Birdeye + Helius price_info),
// taking whichever source has a price — a single source (esp. Helius) misses memecoins like BULL,
// which made big holdings show as $0. Server-side only; reads keys from runtime env.
const HELIUS = process.env.HELIUS_API_KEY;
const BIRDEYE = process.env.BIRDEYE_API_KEY;
const SOL_MINT = 'So11111111111111111111111111111111111111112';

export interface Holding {
  symbol: string;
  mint: string;
  amount: number;
  usd: number;
}
export interface Portfolio {
  totalUsd: number;
  sol: { amount: number; usd: number };
  holdings: Holding[]; // tokens, value-sorted, dust/NFTs removed
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

/** Jupiter price API (free, no key) — the canonical Solana spot source. mint -> USD/token. */
async function jupiterPrices(mints: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const batch of chunk(mints, 100)) {
    try {
      const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${batch.join(',')}`, {
        next: { revalidate: 60 },
      });
      const j = (await r.json()) as Record<string, { usdPrice?: number; price?: number | string }>;
      for (const m of batch) {
        const v = j?.[m]?.usdPrice ?? Number(j?.[m]?.price);
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) out.set(m, v);
      }
    } catch {
      /* ignore a failed batch */
    }
  }
  return out;
}

/** Birdeye multi_price — secondary source for anything Jupiter misses. */
async function birdeyePrices(mints: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!BIRDEYE) return out;
  for (const batch of chunk(mints, 100)) {
    try {
      const r = await fetch(
        `https://public-api.birdeye.so/defi/multi_price?list_address=${batch.join(',')}`,
        { headers: { 'X-API-KEY': BIRDEYE, 'x-chain': 'solana' }, next: { revalidate: 60 } },
      );
      const j = (await r.json()) as { data?: Record<string, { value?: number } | null> };
      for (const m of batch) {
        const v = j.data?.[m]?.value;
        if (typeof v === 'number' && v > 0) out.set(m, v);
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

export async function getHoldings(address: string): Promise<Portfolio | null> {
  if (!HELIUS) return null;
  try {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: address,
          page: 1,
          limit: 1000,
          displayOptions: { showFungible: true, showNativeBalance: true },
        },
      }),
      next: { revalidate: 60 },
    });
    const j = (await r.json()) as {
      result?: {
        nativeBalance?: { lamports?: number; total_price?: number };
        items?: Array<{
          id: string;
          content?: { metadata?: { symbol?: string } };
          token_info?: {
            symbol?: string;
            balance?: number;
            decimals?: number;
            price_info?: { price_per_token?: number };
          };
        }>;
      };
    };
    const res = j.result;
    if (!res) return null;

    // 1) Fungible balances (drop NFTs / 0-decimal dust). Remember Helius' own per-token price.
    const raw: { symbol: string; mint: string; amount: number; heliusPx: number }[] = [];
    for (const a of res.items ?? []) {
      const ti = a.token_info;
      const dec = ti?.decimals ?? 0;
      if (!ti?.balance || dec <= 0) continue;
      const amount = Number(ti.balance) / 10 ** dec;
      if (!(amount > 0)) continue;
      raw.push({
        symbol: ti.symbol || a.content?.metadata?.symbol || a.id.slice(0, 4).toUpperCase(),
        mint: a.id,
        amount,
        heliusPx: ti.price_info?.price_per_token ?? 0,
      });
    }

    // 2) Prices from Jupiter + Birdeye in parallel; combine with Helius — take whichever has it.
    const mints = [SOL_MINT, ...raw.map((h) => h.mint)];
    const [jup, bird] = await Promise.all([jupiterPrices(mints), birdeyePrices(mints)]);
    const priceOf = (mint: string, heliusPx = 0): number =>
      jup.get(mint) ?? bird.get(mint) ?? heliusPx ?? 0;

    const solAmount = (res.nativeBalance?.lamports ?? 0) / 1e9;
    const solPx = priceOf(SOL_MINT);
    const sol = {
      amount: solAmount,
      usd: solPx > 0 ? solAmount * solPx : (res.nativeBalance?.total_price ?? 0),
    };

    // 3) Value, drop sub-$1 dust, sort.
    const holdings = raw
      .map((h) => ({ symbol: h.symbol, mint: h.mint, amount: h.amount, usd: priceOf(h.mint, h.heliusPx) * h.amount }))
      .filter((h) => h.usd >= 1)
      .sort((x, y) => y.usd - x.usd);

    const totalUsd = sol.usd + holdings.reduce((s, h) => s + h.usd, 0);
    return { totalUsd, sol, holdings };
  } catch {
    return null;
  }
}

/** Compact token amount: 10.13M / 1.4K / 1,435 / 0.07. */
export function fmtAmount(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  if (n < 1) return n.toPrecision(2);
  return Math.round(n).toLocaleString('en-US');
}
