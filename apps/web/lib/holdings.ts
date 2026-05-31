// Current portfolio of a wallet (SOL + tokens it still holds), via Helius DAS getAssetsByOwner.
// Server-side only — reads HELIUS_API_KEY from the runtime env (NOT exposed to the browser).
const KEY = process.env.HELIUS_API_KEY;

export interface Holding {
  symbol: string;
  mint: string;
  amount: number;
  usd: number;
}
export interface Portfolio {
  totalUsd: number;
  sol: { amount: number; usd: number };
  holdings: Holding[]; // tokens, value-sorted (USDC + everything else)
}

export async function getHoldings(address: string): Promise<Portfolio | null> {
  if (!KEY) return null;
  try {
    const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${KEY}`, {
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
            price_info?: { total_price?: number };
          };
        }>;
      };
    };
    const res = j.result;
    if (!res) return null;

    const sol = {
      amount: (res.nativeBalance?.lamports ?? 0) / 1e9,
      usd: res.nativeBalance?.total_price ?? 0,
    };

    const holdings: Holding[] = [];
    for (const a of res.items ?? []) {
      const ti = a.token_info;
      if (!ti?.balance) continue;
      const amount = Number(ti.balance) / 10 ** (ti.decimals ?? 0);
      if (!(amount > 0)) continue;
      holdings.push({
        symbol: ti.symbol || a.content?.metadata?.symbol || a.id.slice(0, 4).toUpperCase(),
        mint: a.id,
        amount,
        usd: ti.price_info?.total_price ?? 0,
      });
    }
    holdings.sort((x, y) => y.usd - x.usd);

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
