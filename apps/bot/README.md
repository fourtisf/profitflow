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

It also drives the **public channel** (e.g. `@EXITRADAR`) when `TELEGRAM_CHANNEL_ID` is set — the
bot must be an **admin** of that channel with **Post Messages** permission:

- **Big-exit broadcast** — every exit with `pnl_usd ≥ CHANNEL_MIN_USD` (default `5000`) is posted to
  the channel, independent of who follows the wallet.
- **Scheduled leaderboard** — keeps the channel active when big exits are rare. Pulls
  `${API_URL}/api/leaderboard?range=…` and posts the top traders on a timer.

```bash
TELEGRAM_BOT_TOKEN=… REDIS_URL=redis://127.0.0.1:6380 \
  TELEGRAM_CHANNEL_ID=@EXITRADAR CHANNEL_MIN_USD=5000 \
  API_URL=http://127.0.0.1:4000 \
  pnpm --filter @profitflow/bot start:alerts
```

Leaderboard tuning: `LEADERBOARD_INTERVAL_MS` (default `86400000` = 24h), `LEADERBOARD_RANGE`
(`week`|`all`, default `week`), `LEADERBOARD_TOP_N` (default `10`). The first leaderboard posts ~10s
after boot, then every interval.
