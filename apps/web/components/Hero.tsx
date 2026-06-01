import { LiveFeed } from './LiveFeed';

export function Hero() {
  return (
    <header className="wrap hero">
      <div className="stagger">
        <div className="hero-ca">
          <span>
            CA: <b>coming soon</b>
          </span>
        </div>
        <span className="badge">
          <span className="ldot" /> Live on Solana
        </span>
        <h1>
          Everyone tracks the buys.
          <span className="sub2">We track the cash-out.</span>
        </h1>
        <p className="lead">
          A real-time terminal for realized profit. Watch wallets take money off the table the moment
          it lands on-chain — ranked by dollars.
        </p>
        <div className="cta">
          <a href="#waitlist" className="btn btn-w">
            Open the feed
          </a>
          <a href="#angle" className="btn btn-o">
            Why realized →
          </a>
        </div>
        <div className="note">No signup · No wallet connect · Free to watch</div>
      </div>

      <LiveFeed />
    </header>
  );
}
