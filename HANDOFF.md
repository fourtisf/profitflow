# ProfitFlow — Build Handoff (for Michael)

## What ProfitFlow is
A real-time terminal for **realized profit** on Solana. Everyone tracks whale *buys*; we track
the *cash-out* — wallets taking money off the table, ranked by USD, the moment a sell clears.
Viral angle = a feed you keep open + auto-generated share cards that distribute themselves.

---

## What's already delivered (in this package)

### 1. Landing page — `profitflow.html`
Single self-contained file. Minimal Linear/Vercel aesthetic (monochrome + green only on
profit numbers). Sections: hero with **simulated** live feed, "the angle", a transparency
ledger (worked example), 4 features, and an **interactive share-card generator** with a
working "Download PNG" (renders to a 1080×1080 canvas).
> NOTE: all data on the page is **simulated** for demo. It is a marketing/spec artifact, not
> wired to chain data. Do not ship it as-is as "live".

### 2. Realized-PnL validation kit — `profitflow-pnl/`
This is the core that decides whether the product can exist.
- `pnl-engine.js` — pure, dependency-free engine. Average-cost (primary) + FIFO (comparison).
- `pnl-engine.test.js` — 14 unit tests, **all passing**. Run: `node pnl-engine.test.js`
- `validate.js` — pulls a real wallet's full history from Helius and runs the engine.
- `README.md` — run instructions + accuracy caveats.

---

## Locked decisions (do NOT relitigate without ALFA)
1. **Average cost** is the displayed method. FIFO computed only for comparison.
2. **transfer_in** = tokens received, unknown basis → added at $0 and **flagged**. Never let
   these post a fake "+∞×". Product rule TBD (hide / label "unverified basis" / trace funder).
3. **transfer_out** (self-move) is **not** a sale → removed at avg cost, zero realized PnL.
4. Display copy already commits to: pump.fun · Raydium · Meteora coverage, wash/MEV/LP filtering.

---

## TASK 1 — Validation gate (do this FIRST, before building anything)
Prove the engine matches reality. Nothing else is worth building until this holds.

```bash
HELIUS_API_KEY=<key> node validate.js <WALLET> <TOKEN_MINT> [SOL_USD]
```
- Pick 3 wallets where the realized profit is roughly known (public CT screenshots, or your own).
- Open each on Solscan, check the printed ledger **line by line**.
- **Acceptance:** realized PnL within a small margin of the true cashed-out amount on all 3,
  AND every transfer_in / transfer_out is correctly flagged (no fake infinite multiples).

If it fails: report exactly which tx the deltas misread (router/aggregator parsing is the
likely culprit). We fix the classifier before writing any pipeline code.

**Known #1 error source:** SOL→USD is a flat constant in `validate.js` for sanity only.
Before trusting older positions, swap in **per-timestamp** SOL pricing (Pyth or Birdeye history).

---

## TASK 2 — Real-time pipeline (only if Task 1 passes)
Reuse `pnl-engine.js` unchanged as the source of truth for the math.

- **Universe (bounded — do not track all of Solana):** tokens graduated from pump.fun OR
  liquidity > ~$50k. Keeps RPC/credit cost sane.
- **Ingest:** Helius webhooks for MVP (seconds of latency is fine). Upgrade path: Yellowstone
  gRPC Geyser for sub-second. Parse swaps the same way `validate.js` does (net token delta +
  net value-leg delta per wallet per tx).
- **State:** Redis for hot positions (running cost basis per wallet×token), Postgres for tx
  history + emitted events. On each sell, the basis is already in Redis → instant PnL.
- **Emit rule:** push a "realized profit" event when a sell's realized PnL clears a threshold
  (free feed: > $10k; Pro: from $500).
- **API/feed:** WebSocket push to the client. Production feed needs reconnect logic,
  backpressure, and a capped render buffer (virtualize) — the demo's `setTimeout` won't scale.

## TASK 3 — Distribution loop (this is the actual growth engine)
- Telegram + X bot that auto-posts the biggest realized exit each hour, using the share-card
  generator. The watermark `profitflow.io` must link somewhere real.
- Wire the landing page's "Launch App" + add a capture (waitlist or X-follow) if pre-launch.
- Add OG / `twitter:card` meta tags + `og:image` to `profitflow.html` head — mandatory for a
  share-driven product (the link preview is the first impression).

---

## What Michael needs to set up
- Helius API key with Enhanced Transactions access (+ a paid plan for backfill volume).
- Redis + Postgres.
- A historical SOL price source (Pyth or Birdeye) — required, not optional.

## Open decisions for ALFA
- **Monetization** (pricing was pulled from the page): subscription ($29 Pro tier was drafted),
  token, or referral fees on trade buttons? This affects architecture — decide before Task 2.
- transfer_in product rule (hide vs label vs trace).
- Universe threshold exact value.
