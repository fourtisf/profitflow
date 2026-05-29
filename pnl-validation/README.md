# ProfitFlow — Realized PnL Validation

De-risk the whole product before building anything else: prove the realized-PnL engine
matches reality on real wallets. The page is the easy part; this is the part that can lie.

## Files
- `pnl-engine.js` — pure, testable engine. Average-cost (what we display) + FIFO (comparison).
- `pnl-engine.test.js` — 14 unit tests with hand-checked answers. **All passing.**
- `validate.js` — pulls a real wallet's history from Helius and runs the engine.

## Run the tests (no key needed)
```bash
node pnl-engine.test.js
```

## Validate against a real wallet
```bash
HELIUS_API_KEY=your_key node validate.js <WALLET_ADDRESS> <TOKEN_MINT> [SOL_USD]
```
Then open the wallet on Solscan and check the printed ledger line-by-line. The realized
number should match what the trader actually pulled out.

## The decisions that determine whether the number is true

1. **Average cost vs FIFO.** We display average cost (simpler, defensible). FIFO is also
   computed so you can see how far they diverge on a given wallet. Pick one and never mix.

2. **Transfer-in is the killer.** Tokens received (not bought) have unknown cost basis. We
   add them at $0 and **flag it**, because otherwise a later sale shows a fake "+∞×" gain.
   This is the single fastest way to get roasted on CT. Decide the product rule: hide these
   wallets, label them "unverified basis", or try to trace the funding wallet.

3. **Transfer-out is not a sale.** Moving tokens to your own second wallet must NOT count as
   realized profit. We remove them at average cost with zero PnL and flag it.

4. **SOL pricing is the biggest remaining error source.** `validate.js` uses a flat SOL/USD
   for sanity only. Production MUST price every swap at its block timestamp (Pyth or Birdeye
   historical). A flat price will be off by a lot on older positions.

## Known limitations (be honest about these before launch)
- Relies on Helius parsing `tokenTransfers` / `nativeTransfers`. Exotic routers/aggregators
  may net out oddly in one tx — spot-check a few.
- Network fees (~5000 lamports/tx) ignored; negligible vs memecoin PnL.
- Token-to-token swaps (not via SOL/stable) aren't valued here; add a price oracle if needed.
- Caps at 5000 txs; raise the page cap in `fetchAll` for very active wallets.
