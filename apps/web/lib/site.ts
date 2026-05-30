// One place for site identity. Domain is TBD; change NEXT_PUBLIC_SITE_URL only.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://profitflow.io';
export const SITE_NAME = 'ProfitFlow';

/** Bare host for the share-card watermark, e.g. "profitflow.io". */
export const SITE_HOST = (() => {
  try {
    return new URL(SITE_URL).host.replace(/^www\./, '');
  } catch {
    return 'profitflow.io';
  }
})();

// Optional backend. If unset, the feed runs an in-browser simulation (demo mode).
export const API_URL = process.env.NEXT_PUBLIC_API_URL;
export const API_WS_URL = process.env.NEXT_PUBLIC_API_WS_URL;

export const TAGLINE = 'Everyone tracks the buys. We track the cash-out.';
export const DESCRIPTION =
  'A real-time terminal for realized profit on Solana. Watch wallets take money off the table the moment it lands on-chain — ranked by dollars.';
