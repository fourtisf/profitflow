import { SITE_HOST } from './site';

// Shared OG/twitter card layout. next/og only supports flexbox, so every container is display:flex.
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_ALT = 'ProfitFlow — track the cash-out';

export function renderOg() {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#08090a',
        padding: 72,
        color: '#fafafa',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: '#5fd39a' }} />
        <div style={{ fontSize: 34, fontWeight: 600 }}>ProfitFlow</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 30, color: '#a1a1aa' }}>$GIGA · realized</div>
        <div style={{ display: 'flex', fontSize: 124, fontWeight: 700, color: '#5fd39a', lineHeight: 1 }}>
          +$628,200
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: '#71717a', marginTop: 18 }}>
          We track the cash-out — the moment it clears.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, color: '#4b4d52' }}>
        <div style={{ display: 'flex' }}>Realized profit on Solana</div>
        <div style={{ display: 'flex' }}>{SITE_HOST}</div>
      </div>
    </div>
  );
}
