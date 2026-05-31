import { fmtUsd, fullUsd } from '@profitflow/shared';
import { SITE_HOST } from './site';

// Per-exit share card rendered by /api/card (used by the distribution bot). Mirrors the on-page
// share card. next/og is flexbox-only, so every container sets display:flex.
export const SHARE_SIZE = { width: 1080, height: 1080 } as const;

export interface CardParams {
  ticker: string;
  pnl: number;
  multiple: number | null;
  inUsd: number;
  outUsd: number;
  wallet: string;
}

export function renderShareCard(p: CardParams) {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        background: '#08090a',
        padding: 60,
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0c0d0f',
          border: '2px solid rgba(255,255,255,0.12)',
          borderRadius: 44,
          padding: 60,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#5fd39a' }} />
            <div style={{ fontSize: 36, fontWeight: 600, color: '#fafafa' }}>ExitRadar</div>
          </div>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 2, color: '#71717a' }}>REALIZED</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 44, color: '#a1a1aa' }}>{p.ticker}</div>
          <div
            style={{
              display: 'flex',
              fontSize: p.pnl >= 1_000_000 ? 120 : 140,
              fontWeight: 600,
              color: '#5fd39a',
              lineHeight: 1,
              marginTop: 10,
            }}
          >
            +{fullUsd(p.pnl)}
          </div>
          {p.multiple != null ? (
            <div style={{ display: 'flex', fontSize: 38, color: '#3f8f69', marginTop: 18 }}>
              {p.multiple.toFixed(1)}× return
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: 32, color: '#71717a', marginTop: 18 }}>
              unverified basis
            </div>
          )}
          <div style={{ display: 'flex', fontSize: 32, color: '#71717a', marginTop: 22 }}>
            in {fmtUsd(p.inUsd)} → out {fmtUsd(p.outUsd)}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 30,
            color: '#4b4d52',
            borderTop: '1px solid rgba(255,255,255,0.10)',
            paddingTop: 28,
          }}
        >
          <div style={{ display: 'flex' }}>{p.wallet}</div>
          <div style={{ display: 'flex' }}>{SITE_HOST}</div>
        </div>
      </div>
    </div>
  );
}
