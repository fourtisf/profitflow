import { Reveal } from './Reveal';

const FEATURES = [
  {
    n: '01',
    h: 'Realized PnL engine',
    p: "True cost basis reconstructed from each wallet's full on-chain history, profit computed the moment a sell clears. The real number — not a guess from one transaction.",
  },
  {
    n: '02',
    h: 'Auto share cards',
    p: 'Every large exit generates a clean, branded card built to be screenshotted. Your users handle distribution — each share is a billboard.',
  },
  {
    n: '03',
    h: 'Wallet radar',
    p: 'Follow the wallets that keep topping the board. Get pinged the second they cash out again, before it hits the public feed.',
  },
  {
    n: '04',
    h: 'Sub-second stream',
    p: "A Geyser stream straight off the validator. Exits surface in seconds, not minutes — you see the cash-out while it's still warm.",
  },
];

export function Features() {
  return (
    <section id="features">
      <div className="wrap">
        <Reveal className="feat-head">
          <div className="kicker">Features</div>
          <h2>A feed you keep open all day.</h2>
        </Reveal>
        <Reveal className="feat">
          {FEATURES.map((f) => (
            <div className="f" key={f.n}>
              <div className="n">{f.n}</div>
              <h3>{f.h}</h3>
              <p>{f.p}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
