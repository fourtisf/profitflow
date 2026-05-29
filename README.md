# ProfitFlow

A real-time terminal for **realized profit** on Solana. Everyone tracks whale *buys*;
ProfitFlow tracks the *cash-out* — wallets taking money off the table, ranked by USD, the
moment a sell clears. The growth loop is a feed you keep open plus auto-generated share cards.

> **Source of truth:** [`HANDOFF.md`](./HANDOFF.md) — full spec, the three build tasks, the
> locked decisions, and the open decisions still owned by ALFA. Read it before changing anything.

## Repository layout

| Path | What it is | Status |
| --- | --- | --- |
| [`HANDOFF.md`](./HANDOFF.md) | Spec, tasks, and locked/open decisions | Reference |
| [`pnl-validation/`](./pnl-validation/) | Realized-PnL engine + tests + Helius validator | Engine done; **validation gate not yet run** |
| [`landing-page/profitflow.html`](./landing-page/profitflow.html) | Self-contained marketing page | Demo only — **data is simulated**, not wired to chain |

## Quick start

### Run the engine tests (no API key needed)
```bash
cd pnl-validation
npm test          # or: node pnl-engine.test.js
```
14 unit tests, currently all passing.

### Validate against a real wallet (needs a Helius key)
```bash
cd pnl-validation
HELIUS_API_KEY=<key> node validate.js <WALLET> <TOKEN_MINT> [SOL_USD]
```
Then check the printed ledger line-by-line against Solscan. See
[`pnl-validation/README.md`](./pnl-validation/README.md) for accuracy caveats.

### View the landing page
Open `landing-page/profitflow.html` in a browser. All numbers are simulated for demo —
do **not** ship it as "live".

## Where things stand

The realized-PnL engine and its 14 tests are delivered and green. The **validation gate**
(HANDOFF Task 1) — proving the engine matches reality on 3 real wallets — has **not** been run
yet, and it gates everything downstream (the real-time pipeline and the distribution loop).
Running it requires a Helius API key and a historical SOL price source.

## Caveats worth repeating

- The landing page is a marketing/spec artifact with **simulated** data.
- `validate.js` uses a **flat** SOL→USD price for sanity only; production needs per-timestamp
  pricing (Pyth or Birdeye). This is the single biggest accuracy risk.
- Profit figures are estimates from public on-chain data. Analytics, not financial advice.
