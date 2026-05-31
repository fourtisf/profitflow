import { fullUsd } from '@profitflow/shared';
import { SITE_HOST } from './site';

// Shared OG/twitter card layout. next/og only supports flexbox, so every container is display:flex.
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_ALT = 'ExitRadar — track the cash-out';

const shell = {
  height: '100%',
  width: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'space-between' as const,
  background: '#08090a',
  padding: 72,
  color: '#fafafa',
  fontFamily: 'monospace',
};

function Brand({ tag }: { tag: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: '#5fd39a' }} />
        <div style={{ fontSize: 34, fontWeight: 600 }}>ExitRadar</div>
      </div>
      <div style={{ display: 'flex', fontSize: 22, letterSpacing: 3, color: '#71717a' }}>{tag}</div>
    </div>
  );
}

function Foot({ left }: { left: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, color: '#4b4d52' }}>
      <div style={{ display: 'flex' }}>{left}</div>
      <div style={{ display: 'flex' }}>{SITE_HOST}</div>
    </div>
  );
}

/** Per-wallet share card (1200×630) for link previews on X / Telegram. */
export function renderWalletOg(p: {
  walletShort: string;
  realizedUsd: number;
  exits: number;
  bestMultiple: number | null;
}) {
  return (
    <div style={shell}>
      <Brand tag="WALLET" />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 30, color: '#a1a1aa' }}>{p.walletShort} · realized</div>
        <div style={{ display: 'flex', fontSize: 124, fontWeight: 700, color: '#5fd39a', lineHeight: 1 }}>
          +{fullUsd(p.realizedUsd)}
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: '#71717a', marginTop: 18 }}>
          {p.exits} exit{p.exits === 1 ? '' : 's'}
          {p.bestMultiple != null ? ` · best ${p.bestMultiple.toFixed(1)}×` : ''}
        </div>
      </div>
      <Foot left="Realized profit on Solana" />
    </div>
  );
}

/** Per-token share card (1200×630). */
export function renderTokenOg(p: {
  ticker: string;
  realizedUsd: number;
  wallets: number;
  topExitUsd: number;
}) {
  return (
    <div style={shell}>
      <Brand tag="TOKEN" />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 30, color: '#a1a1aa' }}>{p.ticker} · cashed out</div>
        <div style={{ display: 'flex', fontSize: 124, fontWeight: 700, color: '#5fd39a', lineHeight: 1 }}>
          +{fullUsd(p.realizedUsd)}
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: '#71717a', marginTop: 18 }}>
          {p.wallets} wallet{p.wallets === 1 ? '' : 's'} · top +{fullUsd(p.topExitUsd)}
        </div>
      </div>
      <Foot left="Realized profit on Solana" />
    </div>
  );
}

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
        <div style={{ fontSize: 34, fontWeight: 600 }}>ExitRadar</div>
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
