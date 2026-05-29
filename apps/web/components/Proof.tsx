import { Reveal } from './Reveal';

// Static worked example (illustrative), ported from the approved page — shows that every figure is
// rebuilt from real on-chain history. The numbers here match engine test [1].
export function Proof() {
  return (
    <section id="proof">
      <div className="wrap">
        <Reveal className="proof-head">
          <div className="kicker">The receipts</div>
          <h2>
            Every number, traceable
            <br />
            to the chain.
          </h2>
          <p>
            We don&apos;t guess. Each realized figure is rebuilt from the wallet&apos;s real
            transaction history — every buy, every sell, on-chain and verifiable.
          </p>
        </Reveal>
        <Reveal className="ledger">
          <div className="ledger-top">
            <div>
              <div className="lg-tkr">
                $GIGA <span>Kd4m…8sQe</span>
              </div>
              <div className="lg-cap">Reconstructed cost basis · 3 entries → 1 exit</div>
            </div>
            <div className="lg-badge">ON-CHAIN</div>
          </div>
          <div>
            <div className="lg-row">
              <span className="lg-tag">BUY</span>
              <span className="lg-d">Apr 02 · 14:22</span>
              <span className="lg-amt">−$4,100</span>
              <span className="lg-tx">5Hk…q2P ↗</span>
            </div>
            <div className="lg-row">
              <span className="lg-tag">BUY</span>
              <span className="lg-d">Apr 02 · 18:51</span>
              <span className="lg-amt">−$6,300</span>
              <span className="lg-tx">9bR…7fT ↗</span>
            </div>
            <div className="lg-row">
              <span className="lg-tag">BUY</span>
              <span className="lg-d">Apr 03 · 09:10</span>
              <span className="lg-amt">−$2,600</span>
              <span className="lg-tx">Kd4…m8s ↗</span>
            </div>
            <div className="lg-row">
              <span className="lg-tag sell">SELL</span>
              <span className="lg-d">Apr 05 · 21:47</span>
              <span className="lg-amt out">+$641,200</span>
              <span className="lg-tx">7nB…v5x ↗</span>
            </div>
          </div>
          <div className="lg-foot">
            <div className="lg-calc">
              Cost basis <b>$13,000</b> &nbsp;·&nbsp; Proceeds <b>$641,200</b>
            </div>
            <div className="lg-result">
              Realized <b>+$628,200</b> <span>49.3×</span>
            </div>
          </div>
        </Reveal>
        <Reveal className="sources">
          pump.fun · Raydium · Meteora &nbsp;—&nbsp; cost basis from full wallet history &nbsp;—&nbsp;
          wash trades, MEV &amp; LP moves filtered out
        </Reveal>
      </div>
    </section>
  );
}
