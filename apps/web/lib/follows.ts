// Wallet follows live in the browser (no auth needed). The live feed sends this list over the
// WebSocket; the API pushes an "alert" the moment a followed wallet cashes out.
const KEY = 'exitradar:follows';
export const FOLLOWS_CHANGED = 'exitradar:follows-changed';

export function getFollows(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const arr = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export function isFollowing(wallet: string): boolean {
  return getFollows().includes(wallet);
}

function save(wallets: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...new Set(wallets)].slice(0, 200)));
    window.dispatchEvent(new Event(FOLLOWS_CHANGED));
  } catch {
    /* ignore quota / disabled storage */
  }
}

/** Toggle a wallet; returns true if now following. */
export function toggleFollow(wallet: string): boolean {
  const cur = getFollows();
  const has = cur.includes(wallet);
  save(has ? cur.filter((w) => w !== wallet) : [...cur, wallet]);
  return !has;
}
