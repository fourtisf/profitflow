// sim.test.ts — run: pnpm --filter @profitflow/shared test
// Verifies the SimDataSource produces live-shaped, engine-backed exits and that the
// BaseDataSource buffer/leaderboard/wallet/tier-gating all behave.
import { SimDataSource, config, tierFor } from '../src/index';

let pass = 0,
  fail = 0;
function ok(label: string, cond: boolean): void {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`);
  cond ? pass++ : fail++;
}

async function main(): Promise<void> {
  console.log('\n[1] generate(): engine-backed invariants over 600 samples');
  {
    const sim = new SimDataSource();
    const s = Array.from({ length: 600 }, () => sim.generate());
    ok('id === sig and 64 chars', s.every((e) => e.id === e.sig && e.sig.length === 64));
    ok('pnl >= Pro floor ($' + config.proMinUsd + ')', s.every((e) => e.pnlUsd >= config.proMinUsd));
    ok('tier matches threshold', s.every((e) => e.tier === tierFor(e.pnlUsd)));
    ok(
      'walletShort is first4…last4',
      s.every((e) => e.walletShort === e.wallet.slice(0, 4) + '…' + e.wallet.slice(-4)),
    );
    ok(
      'source in {pump.fun, Raydium, Meteora}',
      s.every((e) => ['pump.fun', 'Raydium', 'Meteora'].includes(e.source)),
    );
    const flagged = s.filter((e) => e.unverifiedBasis);
    const normal = s.filter((e) => !e.unverifiedBasis);
    ok('both flagged and normal exits occur', flagged.length > 0 && normal.length > 0);
    ok(
      'flagged (transfer_in): multiple null, entry 0, pnl == proceeds (never a fake ∞×)',
      flagged.every((e) => e.multiple === null && e.entryUsd === 0 && e.pnlUsd === e.proceedsUsd),
    );
    ok('normal: multiple > 1', normal.every((e) => e.multiple != null && e.multiple > 1));
  }

  console.log('\n[2] BaseDataSource: buffer, tier gating, leaderboard, wallet');
  {
    const sim = new SimDataSource();
    await sim.start();
    const proView = sim.getRecent({ tier: 'pro', limit: 100 });
    const freeView = sim.getRecent({ tier: 'free', limit: 100 });
    ok('seeded buffer is non-empty', proView.length >= 8);
    ok('free view ⊆ pro view', freeView.length <= proView.length);
    ok('free view contains only tier=free', freeView.every((e) => e.tier === 'free'));

    const lb = sim.getLeaderboard('all', 10);
    ok('leaderboard sorted by realizedUsd desc', lb.every((e, i) => i === 0 || lb[i - 1]!.realizedUsd >= e.realizedUsd));

    const someWallet = proView[0]!.wallet;
    const profile = sim.getWallet(someWallet);
    ok('wallet profile returns its exits', !!profile && profile.exits.length >= 1);
    ok('unknown wallet -> null', sim.getWallet('does-not-exist') === null);
    await sim.stop();
  }

  console.log(`\n${'─'.repeat(48)}\nRESULT: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

void main();
