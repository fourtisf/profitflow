// Current portfolio of a wallet (SOL + tokens it still holds).
// Balances come from Helius (getAssetsByOwner); PRICES come from Birdeye (Helius price_info is
// incomplete for memecoins, which made big holdings show as $0). Server-side only — reads
// HELIUS_API_KEY + BIRDEYE_API_KEY from the runtime env (NOT exposed to the browser).
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

async function birdeyePrices(mints: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!BIRDEYE || !mints.length) return out;
  for (let i = 0; i < mints.length; i += 100) {
    const batch = mints.slice(i, i + 100);
    try {
      const r = await fetch(
        `https://public-api.birdeye.so/defi/multi_price?list_address=${batch.join(',')}`,
        { headers: { 'X-API-KEY': BIRDEYE, 'x-chain': 'solana' }, next: { revalidate: 60 } },
      );
      const j = (await r.json()) as { data?: Record<string, { value?: number } | null> };
      for (const m of batch) {
        const v = j.data?.[m]?.value;
        if (typeof v === 'number') out.set(m, v);
      }
    } catch {
      /* ignore a failed batch */
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
          interface?: string;
          content?: { metadata?: { symbol?: string } };
          token_info?: { symbol?: string; balance?: number; decimals?: number };
        }>;
      };
    };
    const res = j.result;
    if (!res) return null;

    // 1) Fungible balances only (drop NFTs / 0-decimal 1-supply dust).
    const raw: { symbol: string; mint: string; amount: number }[] = [];
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
      });
    }

    // 2) Real prices from Birdeye (+ SOL).
    const prices = await birdeyePrices([SOL_MINT, ...raw.map((h) => h.mint)]);
    const solAmount = (res.nativeBalance?.lamports ?? 0) / 1e9;
    const solPrice = prices.get(SOL_MINT);
    const sol = {
      amount: solAmount,
      usd: solPrice != null ? solAmount * solPrice : (res.nativeBalance?.total_price ?? 0),
    };

    // 3) Value, drop sub-$1 dust, sort.
    const holdings = raw
      .map((h) => ({ ...h, usd: (prices.get(h.mint) ?? 0) * h.amount }))
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
