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
