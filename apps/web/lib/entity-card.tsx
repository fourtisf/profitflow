// Bridges page data → the per-entity OG/twitter card JSX. Used by the wallet/token
// opengraph-image + twitter-image routes so X / Telegram link previews show the real numbers.
import { renderTokenOg, renderWalletOg } from './og';
import { getToken, getWallet } from './data';

function short(s: string): string {
  return s.length > 10 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

export async function walletCard(address: string) {
  const p = await getWallet(address);
  return renderWalletOg({
    walletShort: p?.walletShort ?? short(address),
    realizedUsd: p?.realizedUsd ?? 0,
    exits: p?.exits.length ?? 0,
    bestMultiple: p?.bestMultiple ?? null,
  });
}

export async function tokenCard(mint: string) {
  const t = await getToken(mint);
  return renderTokenOg({
    ticker: t?.ticker ?? short(mint),
    realizedUsd: t?.realizedUsd ?? 0,
    wallets: t?.walletsCount ?? 0,
    topExitUsd: t?.topExitUsd ?? 0,
  });
}
