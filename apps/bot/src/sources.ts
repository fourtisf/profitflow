import { fullUsd, type RealizedExit } from '@profitflow/shared';

/** The biggest realized exit the API has seen since `sinceMs`. */
export async function topExitSince(apiUrl: string, sinceMs: number): Promise<RealizedExit | null> {
  const res = await fetch(`${apiUrl}/api/feed/recent?tier=pro&limit=200`);
  if (!res.ok) throw new Error(`api ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { exits: RealizedExit[] };
  const recent = data.exits.filter((e) => e.ts >= sinceMs);
  if (!recent.length) return null;
  return recent.reduce((best, e) => (e.pnlUsd > best.pnlUsd ? e : best));
}

/** Card image URL served by apps/web (/api/card) — reuses the web renderer. */
export function cardUrl(siteUrl: string, e: RealizedExit): string {
  const q = new URLSearchParams({
    t: e.ticker,
    p: String(e.pnlUsd),
    m: e.multiple != null ? String(e.multiple) : '',
    i: String(e.entryUsd),
    o: String(e.proceedsUsd),
    w: e.walletShort,
  });
  return `${siteUrl}/api/card?${q.toString()}`;
}

export function caption(siteUrl: string, e: RealizedExit): string {
  const mult = e.multiple != null ? ` (${e.multiple.toFixed(1)}×)` : '';
  return (
    `${e.ticker} realized +${fullUsd(e.pnlUsd)}${mult}\n` +
    `${e.walletShort} cashed out on ${e.source}.\n` +
    `Track the cash-out → ${siteUrl}`
  );
}
