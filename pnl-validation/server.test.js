// server.test.js — run: node server.test.js
// Validates the Helius-parsing path (classify + pnlFromTransactions) with mock
// transactions, so it needs no API key and makes no network calls.
const { classify, pnlFromTransactions } = require('./server');

const W = 'WALLET';            // these helpers don't validate base58
const M = 'MINT';
const SOL = 150;

const buyTx  = (sig, ts, tokens, solIn)  => ({ signature: sig, timestamp: ts,
  tokenTransfers: [{ mint: M, tokenAmount: tokens, toUserAccount: W, fromUserAccount: 'POOL' }],
  nativeTransfers: [{ amount: solIn * 1e9, fromUserAccount: W, toUserAccount: 'POOL' }] });
const sellTx = (sig, ts, tokens, solOut) => ({ signature: sig, timestamp: ts,
  tokenTransfers: [{ mint: M, tokenAmount: tokens, fromUserAccount: W, toUserAccount: 'POOL' }],
  nativeTransfers: [{ amount: solOut * 1e9, toUserAccount: W, fromUserAccount: 'POOL' }] });

let pass = 0, fail = 0;
const ok = (label, cond) => { console.log(`  ${cond ? '✓' : '✗'} ${label}`); cond ? pass++ : fail++; };
const near = (a, b) => Math.abs(a - b) < 0.01;

console.log('\n[classify]');
{
  const e = classify(buyTx('a', 1, 1000, 10), M, W, SOL);
  ok('buy detected', e && e.kind === 'buy');
  ok('buy usd = 10 SOL × $150 = $1500', e && near(e.usd, 1500));
}
{
  const e = classify(sellTx('b', 2, 1000, 50), M, W, SOL);
  ok('sell detected', e && e.kind === 'sell');
  ok('sell usd = 50 SOL × $150 = $7500', e && near(e.usd, 7500));
}
{
  const e = classify(buyTx('c', 3, 1000, 10), 'OTHER_MINT', W, SOL);
  ok('unrelated token ignored', e === null);
}

console.log('\n[pnlFromTransactions]');
{
  const out = pnlFromTransactions([buyTx('a', 1, 1000, 10), sellTx('b', 2, 1000, 50)], M, W, SOL);
  ok('events = 2', out.events === 2);
  ok('realized = +$6000', near(out.summary.realizedPnL, 6000));
  ok('multiple on sold = 5×', near(out.summary.multipleOnSold, 5));
  ok('ledger has 2 rows', out.ledger.length === 2);
}
{
  // received free, then sold -> overstated, must be flagged
  const tin = { signature: 't', timestamp: 1,
    tokenTransfers: [{ mint: M, tokenAmount: 500, toUserAccount: W, fromUserAccount: 'someone' }],
    nativeTransfers: [] };
  const out = pnlFromTransactions([tin, sellTx('s', 2, 500, 20)], M, W, SOL);
  ok('transfer_in flagged', out.warnings.some(w => w.includes('transfer_in')));
}
{
  const out = pnlFromTransactions([], M, W, SOL);
  ok('no activity -> null summary', out.summary === null);
}

console.log(`\n${'─'.repeat(44)}\nRESULT: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
