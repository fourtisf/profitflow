import Link from 'next/link';
import { fmtUsd, fullUsd, type RealizedExit } from '@profitflow/shared';

function when(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** A static (server-rendered) list of realized exits. Reuses the live-feed row styling. */
export function ExitRows({ exits }: { exits: RealizedExit[] }) {
  if (!exits.length) {
    return <div className="empty">No realized exits in the current window.</div>;
  }
  const rows = [...exits].sort((a, b) => b.ts - a.ts);
  return (
    <div className="elist">
      {rows.map((e) => (
        <div className="row" key={e.id}>
          <div className="r-l">
            <div className="r-top">
              <Link href={`/token/${e.mint}`} className="tkr wlink">
                {e.ticker}
              </Link>
              <Link href={`/wallet/${e.wallet}`} className="wal">
                {e.walletShort}
              </Link>
              <span className="r-src">{e.source}</span>
            </div>
            <div className="r-meta">
              in {fmtUsd(e.entryUsd)}
              <span className="ar">→</span>out {fmtUsd(e.proceedsUsd)}
              {e.unverifiedBasis && <span className="r-unv">unverified basis</span>}
            </div>
          </div>
          <div className="r-r">
            <span className="pnl">+{fullUsd(e.pnlUsd)}</span>
            <span className="mlt">{e.multiple != null ? `${e.multiple.toFixed(1)}×` : '—'}</span>
            <span className="ago">{when(e.ts)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
