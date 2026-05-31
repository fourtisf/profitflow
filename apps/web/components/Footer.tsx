import Link from 'next/link';
import { SITE_HOST } from '../lib/site';
import { Reticle } from './Logo';

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot">
          <div className="logo">
            <Reticle size={16} /> ExitRadar
          </div>
          <div className="fl">
            <a href="https://x.com/exitradar_fun" target="_blank" rel="noreferrer">
              X
            </a>
            <a href="https://t.me/EXITRADAR" target="_blank" rel="noreferrer">
              Telegram
            </a>
            <Link href="/leaderboard">Leaderboard</Link>
            <Link href="/#proof">Docs</Link>
          </div>
          <div className="cc">© 2026 · {SITE_HOST}</div>
        </div>
        <p className="disc">
          Profit figures are estimates from public on-chain data and reconstructed cost basis.
          Transfers, airdrops and cross-wallet activity may affect accuracy. Analytics tool, not
          financial advice. Figures shown in the live feed are simulated until the on-chain pipeline
          is enabled.
        </p>
      </div>
    </footer>
  );
}
