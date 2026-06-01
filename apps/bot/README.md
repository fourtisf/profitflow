# @profitflow/bot

The distribution loop (M5): on a schedule, pick the **biggest realized exit** in the window, render
its **share card** (via `apps/web` `/api/card`, reusing the web renderer), and post to **Telegram**
and **X**. The card watermark links back to the live site — every post is a billboard.

```bash
pnpm --filter @profitflow/bot dev      # runs once now, then hourly
pnpm --filter @profitflow/bot build
```

## How it works

1. `GET ${API_URL}/api/feed/recent?tier=pro&limit=200` → biggest `pnlUsd` since the last window.
2. Build the card URL: `${SITE_URL}/api/card?t=…&p=…&m=…&i=…&o=…&w=…`.
3. Post:
   - **Telegram** — fully wired (`sendPhoto` with the card URL). Needs `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`.
   - **X** — stub (`post.ts`): needs OAuth 1.0a + media upload (`twitter-api-v2`) and `X_*` creds.

Without credentials the bot **dry-runs**: it logs exactly what it would post (including the card URL,
which you can open in a browser). Set `BOT_INTERVAL_MS` / `BOT_MIN_PNL_USD` to tune cadence/threshold.

## Alert bot (`start:alerts`)

The interactive bot (`alert-bot.ts`) lets users DM `/follow <wallet>` and pings them when a followed
wallet cashes out. It subscribes to the worker's Redis exits channel (`REDIS_EXITS_CHANNEL`).

DM commands: `/follow`, `/unfollow`, `/following`, `/leaderboard`. The channel "🔔 Track this wallet"
buttons deep-link back here as `/start follow_<wallet>` and auto-follow.

It also drives the **public channel** (e.g. `@EXITRADAR`) when `TELEGRAM_CHANNEL_ID` is set — the
bot must be an **admin** of that channel with **Post Messages** permission. Five content blocks
(each toggleable with `ENABLE_*=false`):

- **Big-exit broadcast** — every exit with `pnl_usd ≥ CHANNEL_MIN_USD` (default `5000`), in real time.
- **Smart-money signals** (`ENABLE_SIGNALS`) — many distinct wallets dumping one token. Polls
  `${API_URL}/api/signals` every `SIGNAL_INTERVAL_MS` (default 10m); deduped per token (re-announces
  only when the cluster grows), so it never spams.
- **Daily digest** (`ENABLE_DIGEST`) — 24h totals + the biggest exit + the most-distributed token.
- **Leaderboard** (`ENABLE_LEADERBOARD`) — top realized traders from `/api/leaderboard`.
- **Weekly recap** (`ENABLE_WEEKLY`) — Mondays, the week's biggest winners.

Scheduling is cron-like: timed posts fire at UTC wall-clock anchors and are **idempotent across pm2
restarts** (Redis `SET NX` guards keyed by day/week), so a restart never double-posts. A boot post
fires the day's leaderboard + digest immediately the first time each day for instant feedback.

```bash
TELEGRAM_BOT_TOKEN=… REDIS_URL=redis://127.0.0.1:6380 \
  TELEGRAM_CHANNEL_ID=@EXITRADAR CHANNEL_MIN_USD=5000 \
  API_URL=http://127.0.0.1:4000 \
  pnpm --filter @profitflow/bot start:alerts
```

Tuning (UTC hours; Indonesia = UTC+7): `LEADERBOARD_HOUR_UTC` (9), `DIGEST_HOUR_UTC` (13),
`WEEKLY_HOUR_UTC` (10, Mondays), `SIGNAL_INTERVAL_MS` (600000), `SIGNAL_MIN_WALLETS` (3),
`LEADERBOARD_RANGE` (`week`|`all`), `LEADERBOARD_TOP_N` (10), `MAX_SANE_MULTIPLE` (1000 — multiples
above this are treated as unverified-basis artifacts and hidden), `BOT_USERNAME` (auto-detected via
`getMe`, used for deep-links).
