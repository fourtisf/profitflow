import Link from 'next/link';
import type { Metadata } from 'next';
import { fmtUsd, fullUsd, type LeaderboardRange } from '@profitflow/shared';
import { Nav } from '../../components/Nav';
import { Footer } from '../../components/Footer';
import { SearchBox } from '../../components/SearchBox';
import { getLeaderboard, IS_DEMO } from '../../lib/data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Leaderboard — top realized profit',
  description: 'Wallets ranked by realized profit actually cashed out on Solana — this week and all-time.',
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const range: LeaderboardRange = searchParams.range === 'all' ? 'all' : 'week';
  const { entries } = await getLeaderboard(range, 25);

  return (
    <>
      <Nav />
      <main className="wrap page">
        <div className="crumb">
          <Link href="/">ExitRadar</Link> / leaderboard
        </div>
        <div className="page-head">
          <div>
            <h1 className="page-title">
              Realized profit <span className="accent">leaderboard</span>
            </h1>
            <p className="page-sub">Ranked by dollars actually cashed out — not paper gains.</p>
            <SearchBox />
          </div>
          <div className="range-toggle">
            <Link href="/leaderboard?range=week" className={range === 'week' ? 'on' : ''}>
              This week
            </Link>
            <Link href="/leaderboard?range=all" className={range === 'all' ? 'on' : ''}>
              All-time
            </Link>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="empty">No realized exits in this window yet.</div>
        ) : (
          <div className="elist">
            {entries.map((e, i) => (
              <div className="row" key={e.wallet}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span className="rank">#{i + 1}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                    <div className="r-top">
                      <Link href={`/wallet/${e.wallet}`} className="wlink">
                        {e.walletShort}
                      </Link>
                      <span className="r-src">{e.topTicker}</span>
                    </div>
                    <div className="r-meta">
                      {e.exits} exit{e.exits === 1 ? '' : 's'}
                      <span className="ar">·</span>top {fmtUsd(e.topExitUsd)}
                    </div>
                  </div>
                </div>
                <div className="r-r">
                  <span className="pnl">+{fullUsd(e.realizedUsd)}</span>
                  <span className="mlt">
                    {e.bestMultiple != null ? `best ${e.bestMultiple.toFixed(1)}×` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {IS_DEMO && (
          <p className="page-sub" style={{ marginTop: 16 }}>
            Demo data — set <code>NEXT_PUBLIC_API_URL</code> to show live on-chain exits.
          </p>
        )}
      </main>
      <Footer />
    </>
  );
}
