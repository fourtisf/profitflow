'use client';
import { useEffect, useRef, useState } from 'react';
import { fmtUsd, fullUsd, type RealizedExit } from '@profitflow/shared';
import { FeedClient, type FeedStatus } from '../lib/feed-client';
import { FOLLOWS_CHANGED, getFollows } from '../lib/follows';
import { API_WS_URL } from '../lib/site';

const MAX_ROWS = 8; // capped render buffer — the feed never grows unbounded in the DOM

type Row = RealizedExit & { _alert?: boolean };

function statusLabel(s: FeedStatus): string {
  return s === 'live' ? 'live' : s === 'demo' ? 'demo' : s === 'reconnecting' ? 'reconnecting…' : 'connecting…';
}

function ago(now: number, ts: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function LiveFeed() {
  const [exits, setExits] = useState<Row[]>([]);
  const [status, setStatus] = useState<FeedStatus>('connecting');
  const [total, setTotal] = useState(0);
  const [watching, setWatching] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const totalRef = useRef(0);
  const clientRef = useRef<FeedClient | null>(null);

  useEffect(() => {
    const client = new FeedClient(
      API_WS_URL,
      {
        onStatus: setStatus,
        onHello: (recent) => {
          setExits(recent.slice(0, MAX_ROWS));
          totalRef.current = recent.reduce((sum, e) => sum + e.pnlUsd, 0);
          setTotal(totalRef.current);
        },
        onExit: (exit) => {
          setExits((prev) => [exit, ...prev].slice(0, MAX_ROWS));
          totalRef.current += exit.pnlUsd;
          setTotal(totalRef.current);
        },
        onAlert: (exit) => {
          setExits((prev) => [{ ...exit, _alert: true }, ...prev].slice(0, MAX_ROWS));
          totalRef.current += exit.pnlUsd;
          setTotal(totalRef.current);
        },
      },
      'free',
      getFollows(),
    );
    clientRef.current = client;
    client.start();
    setWatching(getFollows().length);

    const syncFollows = () => {
      const f = getFollows();
      setWatching(f.length);
      client.setFollows(f);
    };
    window.addEventListener(FOLLOWS_CHANGED, syncFollows);
    window.addEventListener('storage', syncFollows);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      client.stop();
      clientRef.current = null;
      window.removeEventListener(FOLLOWS_CHANGED, syncFollows);
      window.removeEventListener('storage', syncFollows);
      clearInterval(tick);
    };
  }, []);

  return (
    <div className="panel rv in">
      <div className="p-bar">
        <div className="l">
          <span className="ldot" /> live feed
          <span className={`p-status ${status === 'live' ? 'live' : status === 'demo' ? 'demo' : ''}`}>
            {statusLabel(status)}
          </span>
          {watching > 0 && <span className="watching">★ watching {watching}</span>}
        </div>
        <div className="r">
          today &nbsp;<b>{fmtUsd(total)}</b>
        </div>
      </div>
      <div className="feed">
        {exits.map((e) => (
          <div className={`row${e._alert ? ' alert' : ''}`} key={e.id}>
            <div className="r-l">
              <div className="r-top">
                {e._alert && <span className="r-fav">★ following</span>}
                <span className="tkr">{e.ticker}</span>
                <span className="wal">{e.walletShort}</span>
                <span className="r-src">{e.source}</span>
                <a
                  className="r-scan"
                  href={`https://solscan.io/tx/${e.sig}`}
                  target="_blank"
                  rel="noopener"
                  title="Verify on Solscan"
                >
                  ↗
                </a>
              </div>
              <div className="r-meta">
                {e.unverifiedBasis ? 'basis unknown' : `in ${fmtUsd(e.entryUsd)}`}
                <span className="ar">→</span>out {fmtUsd(e.proceedsUsd)}
                {e.unverifiedBasis && <span className="r-unv">unverified basis</span>}
              </div>
            </div>
            <div className="r-r">
              <span className="pnl">+{fullUsd(e.pnlUsd)}</span>
              <span className="mlt">{e.multiple != null ? `${e.multiple.toFixed(1)}×` : '—'}</span>
              <span className="ago">{ago(now, e.ts)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
