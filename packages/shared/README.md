# @profitflow/shared

Isomorphic (Node + browser) glue used by every app: domain types, env-overridable thresholds,
money/identity formatting, and — most importantly — the **`DataSource` abstraction**.

## The demo-vs-live seam

```
            ┌─────────────────────────────────────────────┐
            │             DataSource (interface)           │
            └─────────────────────────────────────────────┘
                 ▲                                   ▲
        ┌────────┴─────────┐               ┌─────────┴──────────┐
        │  SimDataSource   │               │  LiveDataSource    │
        │  (this package)  │               │  (apps/api, M3)    │
        │  fake, engine-   │               │  reads worker's    │
        │  backed events   │               │  Redis/Postgres    │
        └──────────────────┘               └────────────────────┘
```

`apps/api` selects one by the `DATA_SOURCE` env (`sim` | `helius`). REST, WebSocket, and the
web frontend are identical regardless — **the frontend never knows which source is live.** This is
how the site can deploy and look alive today with zero keys, then flip to real data later.

### `SimDataSource`

Ported from the approved landing page, but every number is produced by running synthetic
`buy/sell` (or `transfer_in/sell`) events through the **real `@profitflow/pnl-engine`**. So the
simulated feed exhibits the exact same behavior live data will — including the `transfer_in`
"unverified basis" trap (multiple shown as `null`, never a fake `+∞×`).

### `BaseDataSource`

Provides the machinery every source needs: a newest-first ring buffer, **idempotent** publish
(dedupe by tx signature), listener fan-out, and derived **leaderboard** / **wallet profile** views.
Concrete sources only implement ingestion and call `publish()`.

## Config thresholds (env-overridable)

| Key | Default | Meaning |
| --- | --- | --- |
| `FREE_MIN_USD` | `10000` | Free public feed shows exits ≥ this. |
| `PRO_MIN_USD` | `500` | Pro tier sees exits down to this. |
| `UNIVERSE_LIQUIDITY_FLOOR_USD` | `50000` | Min token liquidity the worker tracks (M3). |

```bash
pnpm --filter @profitflow/shared test       # sim + buffer + gating invariants
pnpm --filter @profitflow/shared typecheck
```
