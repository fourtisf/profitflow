# @profitflow/web

The marketing site + product surface: landing page, **live feed**, **share-card generator**
(1080×1080 PNG export), restored **$29 Pro pricing**, **waitlist**, and **OG/twitter** images.
Next.js 14 (App Router) + Tailwind. Deploys to Vercel.

```bash
pnpm --filter @profitflow/web dev        # http://localhost:3000
pnpm --filter @profitflow/web build
pnpm --filter @profitflow/web typecheck
```

## Demo vs live (no code change)

The feed uses `FeedClient`:

- **`NEXT_PUBLIC_API_WS_URL` set** → connects to `apps/api` over WebSocket, with exponential-backoff
  reconnect and a capped render buffer.
- **unset / unreachable** → falls back to an in-browser `SimDataSource`, so the deployed site looks
  alive immediately with **zero keys** (status chip shows `demo`).

## Env

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL, OG/twitter, share-card watermark (domain TBD → one place to change). |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_API_WS_URL` | Point the feed at the live API. Optional. |
| `DATABASE_URL` | Optional — persist waitlist signups (else `/api/waitlist` logs and returns ok). |

## Deploy to Vercel

1. Import the repo, set **root** to `apps/web` (or use the monorepo settings; build = `next build`).
2. Set `NEXT_PUBLIC_SITE_URL` (and the API URLs once `apps/api` is up).
3. Deploy. With no API env, it ships in demo mode and still looks live.

> The live feed is **simulated** until `apps/worker` + `DATA_SOURCE=helius` are enabled — the footer
> says so. Do not present demo numbers as real.
