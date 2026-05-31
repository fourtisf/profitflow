'use client';
import { useEffect, useState } from 'react';
import { isFollowing, toggleFollow } from '../lib/follows';

/** Follow/unfollow a wallet (stored in the browser). The live feed alerts on followed wallets. */
export function FollowButton({ wallet }: { wallet: string }) {
  const [following, setFollowing] = useState(false);
  useEffect(() => setFollowing(isFollowing(wallet)), [wallet]);
  return (
    <button
      type="button"
      className={`btn ${following ? 'btn-o' : 'btn-w'}`}
      aria-pressed={following}
      title="Get a live alert the moment this wallet cashes out — even below the public threshold."
      onClick={() => setFollowing(toggleFollow(wallet))}
    >
      {following ? '★ Following' : '☆ Follow wallet'}
    </button>
  );
}
