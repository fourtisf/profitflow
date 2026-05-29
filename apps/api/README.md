# @profitflow/api

REST + WebSocket feed. **Source-agnostic**: serves identical data whether `DATA_SOURCE=sim`
(default, no keys) or `helius` (reads the worker's emitted events from Redis + Postgres).

```bash
pnpm --filter @profitflow/api dev      # tsx watch, defaults to sim on :4000
pnpm --filter @profitflow/api build    # tsup -> dist/
pnpm --filter @profitflow/api start    # node dist/index.js
```

## REST

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | `{ ok, source, uptimeMs }` |
| GET | `/api/config` | `{ source, freeMinUsd, proMinUsd }` |
| GET | `/api/feed/recent?limit=&tier=` | Recent exits, tier-gated |
| GET | `/api/leaderboard?range=week\|all&limit=` | Trader of the week / all-time |
| GET | `/api/wallet/:address` | A wallet's realized history (404 if outside window) |
| POST | `/api/waitlist` `{ email }` | Waitlist capture |
| GET/POST | `/api/follows` | Wallet follow list (M4) |
| DELETE | `/api/follows/:wallet` | Unfollow |

## WebSocket — `ws://host/ws?tier=free|pro`

Server → client: `{type:'hello', recent, tier}` on connect, then `{type:'exit', exit}` per new exit.
Production-grade: 30s heartbeat (dead clients dropped), 1MB per-client backpressure cap, tier gating
(free clients never receive Pro-only exits). The client owns reconnect + a capped render buffer.

## Tier gating

`free` sees exits ≥ `FREE_MIN_USD` ($10k); `pro` sees down to `PRO_MIN_USD` ($500). Tier is read
from `?tier=` / `x-pf-tier` for now — **real auth + Stripe billing** (monetization = $29 Pro
subscription) gets wired before public Pro sign-ups. Pass `?tier=pro` to see gating in action.

## Graceful degradation

In `helius` mode with missing/erroring `REDIS_URL` / `DATABASE_URL`, the API logs and serves an
empty (or last-known) feed instead of crashing.
