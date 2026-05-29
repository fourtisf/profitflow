// Money/identity formatting shared by web, the OG image, and the bot — so a "$1.2M" looks
// identical everywhere. Ported from the approved landing page (fmt / full / wallet).

/** Compact: $1.20M / $48.0K / $640. */
export function fmtUsd(n: number): string {
  return n >= 1e6
    ? '$' + (n / 1e6).toFixed(2) + 'M'
    : n >= 1e3
      ? '$' + (n / 1e3).toFixed(1) + 'K'
      : '$' + Math.round(n);
}

/** Full, grouped: $641,200. */
export function fullUsd(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** Signed full: +$628,200 / -$1,200. */
export function signedUsd(n: number): string {
  return (n >= 0 ? '+' : '-') + fullUsd(Math.abs(n));
}

/** Kd4m…8sQe */
export function shortWallet(addr: string): string {
  if (!addr || addr.length <= 9) return addr;
  return addr.slice(0, 4) + '…' + addr.slice(-4);
}
