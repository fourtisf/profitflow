import { config } from '@profitflow/shared';
import { Reveal } from './Reveal';

// Restored pricing (locked decision: $29 Pro subscription). Thresholds are read from shared config
// so the copy and the API gating can never drift apart.
const k = (n: number): string => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`);

function Check() {
  return <span className="ch">✓</span>;
}

export function Pricing() {
  return (
    <section id="pricing">
      <div className="wrap">
        <Reveal className="pr-head">
          <div className="kicker">Pricing</div>
          <h2>Watch for free. Go Pro to get there first.</h2>
        </Reveal>
        <Reveal className="plans">
          <div className="plan">
            <div className="pn">Free</div>
            <div className="pp">
              $0 <small>/ forever</small>
            </div>
            <ul>
              <li>
                <Check /> Public realized feed (exits over {k(config.freeMinUsd)})
              </li>
              <li>
                <Check /> Auto-generated share cards
              </li>
              <li>
                <Check /> Weekly leaderboard
              </li>
              <li className="off">
                <Check /> Every exit from {k(config.proMinUsd)}
              </li>
              <li className="off">
                <Check /> Wallet radar &amp; instant alerts
              </li>
              <li className="off">
                <Check /> API access
              </li>
            </ul>
            <a href="#waitlist" className="btn btn-o">
              Open the feed
            </a>
          </div>

          <div className="plan pro">
            <div className="pn">Pro</div>
            <div className="pp">
              $29 <small>/ month</small>
            </div>
            <ul>
              <li>
                <Check /> Everything in Free
              </li>
              <li>
                <Check /> Every exit from {k(config.proMinUsd)} — before the public feed
              </li>
              <li>
                <Check /> Wallet radar &amp; instant alerts
              </li>
              <li>
                <Check /> All-time leaderboard &amp; wallet profiles
              </li>
              <li>
                <Check /> API access
              </li>
            </ul>
            <a href="#waitlist" className="btn btn-w">
              Start Pro
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
