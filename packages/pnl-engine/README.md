# @profitflow/pnl-engine

The pure, dependency-free realized-PnL engine — the core that decides whether ProfitFlow can
exist. Ported **verbatim** from the validated JS engine (the math is unchanged; only TypeScript
types were added). This is the single source of truth for the math across `web`, `api`, and `worker`.

## What it does

Given an ordered list of position events for **one wallet × one token mint**, it computes realized
PnL two ways:

- **Average cost** — what ProfitFlow displays.
- **FIFO** — computed only for comparison (proves the method choice matters).

### The traps it handles (this is the whole point)

| Case | Behavior |
| --- | --- |
| `transfer_in` (tokens received, unknown basis) | Added at **$0 cost** and **flagged** in `warnings`. Never posts a fake "+∞×". |
| `transfer_out` (self-move, not a sale) | Removed at **average cost**, **zero** realized PnL. |
| oversell (sold more than held — bad data) | **Clamped** and flagged, never crashes. |

## Usage

```ts
import { computeAverageCost, type PositionEvent } from '@profitflow/pnl-engine';

const events: PositionEvent[] = [
  { kind: 'buy',  amount: 1_000_000, usd: 13_000,  sig: 'aaa' },
  { kind: 'sell', amount: 1_000_000, usd: 641_200, sig: 'bbb' },
];

const r = computeAverageCost(events);
// r.realizedPnL === 628200, r.multipleOnSold === 49.32, r.warnings === []
```

## Scripts

```bash
pnpm --filter @profitflow/pnl-engine test        # 14 assertions, must stay green
pnpm --filter @profitflow/pnl-engine typecheck

# Validation gate (HANDOFF Task 1) — needs your own Helius key:
HELIUS_API_KEY=xxx pnpm validate <WALLET> <TOKEN_MINT> [SOL_USD]
```

### `validate` accuracy caveat

`validate` uses a **flat** SOL→USD price for sanity only. It is the single biggest accuracy risk.
Production (`apps/worker`, M3) must price each swap at its **block timestamp** (Pyth/Birdeye
history). Until then, treat older positions as approximate and check the printed ledger against
Solscan line-by-line.
