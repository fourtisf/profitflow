# @profitflow/worker

The ingest pipeline (M3): **Helius → parse → engine → Redis (hot positions) → emit to Postgres +
Redis pub/sub**. The API live-tails the Redis channel; the web feed shows it. The engine is the
**single source of truth for the math** — positions re-run `computeAverageCost` per event.

```bash
pnpm --filter @profitflow/worker dev      # sim dry-run by default
pnpm --filter @profitflow/worker build
```

## Modes

- **`DATA_SOURCE=sim` (default)** — dry-run: pipes simulated exits through the **real emit path**, so
  you can exercise Postgres/Redis (or just watch the logs) without any keys. Pair with the API in
  `helius` mode (reading Redis/Postgres) to test the full produce→consume loop locally.
- **`DATA_SOURCE=helius` + `HELIUS_API_KEY`** — real ingest:
  - **Webhook** receiver on `WORKER_WEBHOOK_PORT` (point a Helius webhook here) + **polling**
    fallback over `WATCH_ADDRESSES`.
  - **Per-timestamp** SOL→USD pricing via Birdeye (`BIRDEYE_API_KEY`). A flat price is the #1 error
    source and is refused in spirit — without a key it falls back to *spot* price with a loud warning.
  - **Bounded universe** (liquidity ≥ `$50k` or pump.fun graduations) — `universe.ts` (auto-refresh TODO).
  - Emits when a sell's realized PnL clears the Pro floor (`$500`); the API gates free vs Pro.

## Persistence

`prisma/schema.prisma` defines `pf_events` (+ `pf_waitlist`). Apply it:

```bash
DATABASE_URL=postgresql://... pnpm --filter @profitflow/worker prisma:push
```

The emit row shape (snake_case) is the contract the API's `LiveDataSource` reads — keep them in sync.

## Known TODOs before production

- Resolve real token symbols (Helius metadata) instead of the `mint`-prefix placeholder ticker.
- Implement `Universe.refresh()` against a liquidity source.
- Wire Pyth as an alternative historical price source.
- Multi-mint txs share the value leg approximately; split precisely for aggregator routes.
