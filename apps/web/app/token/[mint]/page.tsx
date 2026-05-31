import Link from 'next/link';
import type { Metadata } from 'next';
import { detectClusterExits, fullUsd } from '@profitflow/shared';
import { Nav } from '../../../components/Nav';
import { Footer } from '../../../components/Footer';
import { ExitRows } from '../../../components/ExitRows';
import { getToken, IS_DEMO } from '../../../lib/data';

const SIGNAL_WINDOW_MS = 48 * 60 * 60 * 1000;

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { mint: string } }): Promise<Metadata> {
  const t = await getToken(params.mint);
  const name = t?.ticker ?? `${params.mint.slice(0, 4)}…`;
  const title = `${name} — who's cashing out`;
  const description = t
    ? `${t.walletsCount} wallets have realized ${fullUsd(t.realizedUsd)} exiting ${name} on Solana.`
    : `Realized exits for ${name} on Solana.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default async function TokenPage({ params }: { params: { mint: string } }) {
  const token = await getToken(params.mint);
  const cluster = token
    ? detectClusterExits(token.exits, { windowMs: SIGNAL_WINDOW_MS, minWallets: 3 })[0]
    : undefined;

  return (
    <>
      <Nav />
      <main className="wrap page">
        <div className="crumb">
          <Link href="/leaderboard">Leaderboard</Link> / token
        </div>

        {!token ? (
          <>
            <h1 className="page-title">Token</h1>
            <div className="addr">{params.mint}</div>
            <div className="empty" style={{ marginTop: 24 }}>
              No realized exits seen for this token in the current window.
            </div>
          </>
        ) : (
          <>
            <div className="page-head">
              <div>
                <h1 className="page-title">
                  <span className="accent">{token.ticker}</span> cash-outs
                </h1>
                <a
                  className="addr"
                  href={`https://solscan.io/token/${token.mint}`}
                  target="_blank"
                  rel="noopener"
                  title="Verify this token on Solscan"
                >
                  {token.mint} ↗
                </a>
              </div>
              {IS_DEMO && <span className="demo-note">demo data</span>}
            </div>

            {cluster && (
              <div className="signal">
                <span className="signal-dot" /> Distribution detected —{' '}
                <b>{cluster.wallets} wallets</b> cashed out {token.ticker} in the last 48h, pulling{' '}
                <b>+{fullUsd(cluster.realizedUsd)}</b> off the table.
              </div>
            )}

            <div className="statrow">
              <div className="stat">
                <div className="k">Realized (all wallets)</div>
                <div className="v green">+{fullUsd(token.realizedUsd)}</div>
              </div>
              <div className="stat">
                <div className="k">Exits</div>
                <div className="v">{token.exitsCount}</div>
              </div>
              <div className="stat">
                <div className="k">Wallets</div>
                <div className="v">{token.walletsCount}</div>
              </div>
              <div className="stat">
                <div className="k">Top exit</div>
                <div className="v green">+{fullUsd(token.topExitUsd)}</div>
              </div>
            </div>

            <ExitRows exits={token.exits} />
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
