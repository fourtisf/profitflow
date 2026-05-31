import Link from 'next/link';
import { fmtUsd, fullUsd, type RealizedExit } from '@profitflow/shared';

function when(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const UNVERIFIED_HINT =
  'Tokens arrived via transfer with unknown cost basis — we never invent a multiple, so it shows “—”.';

/** A static (server-rendered) list of realized exits with a "show the math" drill-down. */
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
              {e.unverifiedBasis && (
                <span className="r-unv" title={UNVERIFIED_HINT}>
                  unverified basis
                </span>
              )}
            </div>
            <details className="r-math">
              <summary>show the math</summary>
              <div className="math-body">
                <div>
                  <span>Method</span>
                  <span>average cost</span>
                </div>
                <div>
                  <span>Cost basis (buys)</span>
                  <span>{e.unverifiedBasis ? 'unknown — received, not bought' : fmtUsd(e.entryUsd)}</span>
                </div>
                <div>
                  <span>Proceeds (sell)</span>
                  <span>{fmtUsd(e.proceedsUsd)}</span>
                </div>
                <div>
                  <span>Realized</span>
                  <span className="green">+{fullUsd(e.pnlUsd)}</span>
                </div>
                <div>
                  <span>Multiple</span>
                  <span>{e.multiple != null ? `${e.multiple.toFixed(2)}×` : '— (basis unverified)'}</span>
                </div>
              </div>
            </details>
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
