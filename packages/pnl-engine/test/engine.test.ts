// engine.test.ts — run: pnpm --filter @profitflow/pnl-engine test  (tsx test/engine.test.ts)
// Ported verbatim from the validated pnl-engine.test.js. 14 assertions, must stay green.
import { computeAverageCost, computeFIFO, type PositionEvent } from '../src/engine';

let pass = 0,
  fail = 0;
function eq(label: string, got: number, want: number): void {
  const ok = Math.abs(got - want) < 0.01;
  console.log(`  ${ok ? '✓' : '✗'} ${label}: got ${got}  want ${want}`);
  ok ? pass++ : fail++;
}
function truthy(label: string, v: unknown): void {
  console.log(`  ${v ? '✓' : '✗'} ${label}`);
  v ? pass++ : fail++;
}

console.log('\n[1] Landing-page example: one buy block ($13k) -> one exit ($641.2k)');
{
  const r = computeAverageCost([
    { kind: 'buy', amount: 1_000_000, usd: 13000, sig: 'aaa' },
    { kind: 'sell', amount: 1_000_000, usd: 641200, sig: 'bbb' },
  ]);
  eq('realized', r.realizedPnL, 628200);
  eq('multipleOnSold', r.multipleOnSold as number, 49.32);
  eq('tokensRemaining', r.tokensRemaining, 0);
}

console.log('\n[2] Average cost across two entries, partial sell');
{
  const ev: PositionEvent[] = [
    { kind: 'buy', amount: 100, usd: 1000, sig: 'b1' }, // $10/tok
    { kind: 'buy', amount: 100, usd: 3000, sig: 'b2' }, // $30/tok -> avg $20
    { kind: 'sell', amount: 100, usd: 5000, sig: 's1' }, // basis 100*$20 = $2000
  ];
  const r = computeAverageCost(ev);
  eq('avg realized', r.realizedPnL, 3000);
  eq('avg tokensRemaining', r.tokensRemaining, 100);
  eq('avg costBasisRemaining', r.costBasisRemaining, 2000);

  const f = computeFIFO(ev); // FIFO sells the $10 lot first
  eq('fifo realized', f.realizedPnL, 4000);
  eq('fifo costBasisRemaining', f.costBasisRemaining, 3000);
  console.log('    -> avg vs FIFO differ ($3000 vs $4000): proves method choice matters');
}

console.log('\n[3] TRANSFER-IN TRAP: tokens received free, then sold');
{
  const r = computeAverageCost([
    { kind: 'transfer_in', amount: 1000, sig: 'tin' },
    { kind: 'sell', amount: 1000, usd: 50000, sig: 'sell' },
  ]);
  eq('realized (overstated, $0 basis)', r.realizedPnL, 50000);
  truthy(
    'transfer_in flagged in warnings',
    r.warnings.some((w) => w.includes('transfer_in')),
  );
  console.log('    -> WITHOUT this flag the tool would post a fake "+$50k / ∞x" and die on CT');
}

console.log('\n[4] TRANSFER-OUT (self-move) must NOT count as profit');
{
  const r = computeAverageCost([
    { kind: 'buy', amount: 200, usd: 2000, sig: 'b' }, // avg $10
    { kind: 'transfer_out', amount: 100, sig: 'tout' }, // leaves, no sale
    { kind: 'sell', amount: 100, usd: 5000, sig: 's' }, // basis $1000
  ]);
  eq('realized counts only the real sale', r.realizedPnL, 4000);
  eq('tokensRemaining', r.tokensRemaining, 0);
  truthy(
    'transfer_out flagged',
    r.warnings.some((w) => w.includes('transfer_out')),
  );
}

console.log('\n[5] Oversell (missing buy data) is clamped + flagged, no crash');
{
  const r = computeAverageCost([
    { kind: 'buy', amount: 50, usd: 500, sig: 'b' },
    { kind: 'sell', amount: 100, usd: 2000, sig: 's' },
  ]);
  truthy(
    'oversell flagged',
    r.warnings.some((w) => w.includes('oversell')),
  );
}

console.log(`\n${'─'.repeat(48)}\nRESULT: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
