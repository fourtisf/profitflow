import { SITE_HOST } from '../lib/site';

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot">
          <div className="logo">
            <span className="dot" /> ProfitFlow
          </div>
          <div className="fl">
            <a href="https://x.com" target="_blank" rel="noreferrer">
              X
            </a>
            <a href="https://t.me" target="_blank" rel="noreferrer">
              Telegram
            </a>
            <a href="#proof">Docs</a>
            <a href="#pricing">API</a>
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
