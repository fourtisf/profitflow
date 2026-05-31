// signals.test.ts — run: pnpm --filter @profitflow/shared test
// Verifies the smart-money cluster-exit detector: windowing, distinct-wallet threshold,
// per-mint grouping, dollar aggregation, and ordering.
import { detectClusterExits, type RealizedExit } from '../src/index';

let pass = 0,
  fail = 0;
function ok(label: string, cond: boolean): void {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`);
  cond ? pass++ : fail++;
}

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

function mk(mint: string, wallet: string, ageMs: number, pnl = 10_000): RealizedExit {
  return {
    id: `${mint}:${wallet}:${ageMs}`,
    sig: `${mint}:${wallet}:${ageMs}`,
    ts: NOW - ageMs,
    ticker: '$' + mint.toUpperCase(),
    mint,
    wallet,
    walletShort: wallet.slice(0, 4) + '…' + wallet.slice(-4),
    entryUsd: 100,
    proceedsUsd: 100 + pnl,
    pnlUsd: pnl,
    multiple: 2,
    source: 'Raydium',
    unverifiedBasis: false,
    tier: 'free',
  };
}

function main(): void {
  console.log('\n[1] empty / below-threshold');
  ok('empty input -> no signals', detectClusterExits([], { now: NOW }).length === 0);
  ok(
    '2 distinct wallets (min 3) -> no signal',
    detectClusterExits([mk('AAA', 'w1', HOUR), mk('AAA', 'w2', 2 * HOUR)], { now: NOW }).length === 0,
  );

  console.log('\n[2] a real cluster');
  {
    const sigs = detectClusterExits(
      [mk('AAA', 'w1', HOUR, 5_000), mk('AAA', 'w2', 2 * HOUR, 7_000), mk('AAA', 'w3', 3 * HOUR, 8_000)],
      { now: NOW },
    );
    ok('3 distinct wallets in window -> 1 signal', sigs.length === 1);
    ok('signal counts 3 wallets', sigs[0]?.wallets === 3);
    ok('signal sums realizedUsd (20,000)', sigs[0]?.realizedUsd === 20_000);
    ok('signal carries ticker', sigs[0]?.ticker === '$AAA');
  }

  console.log('\n[3] windowing + de-dupe');
  ok(
    'exits older than window are excluded',
    detectClusterExits(
      [mk('AAA', 'w1', HOUR), mk('AAA', 'w2', 2 * HOUR), mk('AAA', 'w3', 99 * HOUR)],
      { now: NOW },
    ).length === 0,
  );
  ok(
    'same wallet repeated counts once (not a cluster)',
    detectClusterExits([mk('AAA', 'w1', HOUR), mk('AAA', 'w1', 2 * HOUR), mk('AAA', 'w1', 3 * HOUR)], {
      now: NOW,
    }).length === 0,
  );
  ok(
    'custom window widens the net',
    detectClusterExits(
      [mk('AAA', 'w1', HOUR), mk('AAA', 'w2', 10 * HOUR), mk('AAA', 'w3', 20 * HOUR)],
      { now: NOW, windowMs: 24 * HOUR },
    ).length === 1,
  );

  console.log('\n[4] multiple tokens, ordered strongest-first');
  {
    const exits = [
      // BBB: 3 wallets, $30k
      mk('BBB', 'b1', HOUR, 10_000),
      mk('BBB', 'b2', HOUR, 10_000),
      mk('BBB', 'b3', HOUR, 10_000),
      // CCC: 4 wallets, $8k
      mk('CCC', 'c1', HOUR, 2_000),
      mk('CCC', 'c2', HOUR, 2_000),
      mk('CCC', 'c3', HOUR, 2_000),
      mk('CCC', 'c4', HOUR, 2_000),
    ];
    const sigs = detectClusterExits(exits, { now: NOW });
    ok('two clusters detected', sigs.length === 2);
    ok('more wallets ranks first (CCC before BBB)', sigs[0]?.mint === 'CCC' && sigs[1]?.mint === 'BBB');
  }

  console.log(`\n${'─'.repeat(48)}\nRESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main();
