import Link from 'next/link';
import type { Metadata } from 'next';
import { fmtUsd, fullUsd } from '@profitflow/shared';
import { Nav } from '../../../components/Nav';
import { Footer } from '../../../components/Footer';
import { ExitRows } from '../../../components/ExitRows';
import { FollowButton } from '../../../components/FollowButton';
import { getWallet, IS_DEMO } from '../../../lib/data';
import { getHoldings, fmtAmount } from '../../../lib/holdings';

export const dynamic = 'force-dynamic';

function shorten(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

export async function generateMetadata({
  params,
}: {
  params: { address: string };
}): Promise<Metadata> {
  const p = await getWallet(params.address);
  const short = p?.walletShort ?? shorten(params.address);
  const title = `${short} — realized exits`;
  const description = p
    ? `${short} has realized ${fullUsd(p.realizedUsd)} across ${p.exits.length} cash-outs on Solana.`
    : `Realized profit history for ${short} on Solana.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default async function WalletPage({ params }: { params: { address: string } }) {
  const [profile, portfolio] = await Promise.all([
    getWallet(params.address),
    getHoldings(params.address),
  ]);

  return (
    <>
      <Nav />
      <main className="wrap page">
        <div className="crumb">
          <Link href="/leaderboard">Leaderboard</Link> / wallet
        </div>

        {!profile ? (
          <>
            <h1 className="page-title">Wallet</h1>
            <div className="addr">{params.address}</div>
            <div className="empty" style={{ marginTop: 24 }}>
              No realized exits seen for this wallet in the current window.
            </div>
          </>
        ) : (
          <>
            <div className="page-head">
              <div>
                <h1 className="page-title">
                  Wallet <span className="accent">{profile.walletShort}</span>
                </h1>
                <a
                  className="addr"
                  href={`https://solscan.io/account/${profile.wallet}`}
                  target="_blank"
                  rel="noopener"
                  title="Verify this wallet on Solscan"
                >
                  {profile.wallet} ↗
                </a>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <FollowButton wallet={profile.wallet} />
                {IS_DEMO && <span className="demo-note">demo data</span>}
              </div>
            </div>

            <div className="statrow">
              <div className="stat">
                <div className="k">Realized profit</div>
                <div className="v green">+{fullUsd(profile.realizedUsd)}</div>
              </div>
              <div className="stat">
                <div className="k">Exits</div>
                <div className="v">{profile.exits.length}</div>
              </div>
              <div className="stat">
                <div className="k">Best multiple</div>
                <div className="v">
                  {profile.bestMultiple != null ? `${profile.bestMultiple.toFixed(1)}×` : '—'}
                </div>
              </div>
              <div className="stat">
                <div className="k">Top exit</div>
                <div className="v green">
                  +{fullUsd(Math.max(...profile.exits.map((e) => e.pnlUsd)))}
                </div>
              </div>
            </div>

            {portfolio && (portfolio.sol.amount > 0 || portfolio.holdings.length > 0) && (
              <div className="holds-wrap">
                <div className="holds-head">
                  Still holding <span className="muted">· {fmtUsd(portfolio.totalUsd)} total</span>
                </div>
                <div className="holds">
                  <div className="hold">
                    <span className="h-sym">SOL</span>
                    <span className="h-amt">{fmtAmount(portfolio.sol.amount)}</span>
                    <span className="h-usd">{fmtUsd(portfolio.sol.usd)}</span>
                  </div>
                  {portfolio.holdings.slice(0, 11).map((h) => (
                    <a
                      key={h.mint}
                      className="hold"
                      href={`https://solscan.io/token/${h.mint}`}
                      target="_blank"
                      rel="noopener"
                      title={`${h.symbol} on Solscan`}
                    >
                      <span className="h-sym">{h.symbol}</span>
                      <span className="h-amt">{fmtAmount(h.amount)}</span>
                      <span className="h-usd">{fmtUsd(h.usd)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <ExitRows exits={profile.exits} />
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
