# Deploy the ExitRadar web app to Vercel

The web app (`apps/web`) is a Next.js app: landing + live feed + **wallet / token /
leaderboard pages** + auto share cards. It runs in **demo mode** (in-browser simulation) until
you point it at the API, so you can ship it now and wire the backend later.

> This is **separate** from the static landing at `exitradar.fun` (served from the VPS, see
> `DEPLOY-VPS.md`). The Next app is the real product — host it at e.g. **app.exitradar.fun**.

## 1. Import the repo

1. Go to **vercel.com → Add New → Project** and import `fourtisf/profitflow`.
2. **Root Directory:** set to **`apps/web`** (click *Edit* next to Root Directory).
   Vercel auto-detects the pnpm workspace and installs from the repo root.
3. **Framework Preset:** Next.js (auto-detected). Leave Build/Output commands as default.

## 2. Environment variables

Add these in **Project → Settings → Environment Variables**:

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://app.exitradar.fun` | the domain you'll serve from (OG tags, share-card watermark) |
| `NEXT_PUBLIC_API_URL` | *(leave unset for now)* | set later to the live API → switches feed/pages from demo to live |
| `NEXT_PUBLIC_API_WS_URL` | *(leave unset for now)* | e.g. `wss://api.exitradar.fun/ws` once the API is up |

Leaving the API vars unset is fine — the site stays alive in demo mode.

## 3. Deploy + custom domain

1. Click **Deploy**. First build takes ~2 min.
2. **Project → Settings → Domains → Add** `app.exitradar.fun`.
3. At your DNS (Cloudflare): add a **CNAME** `app` → `cname.vercel-dns.com` (Vercel shows the
   exact target). HTTPS is automatic.

## 4. Verify

- `https://app.exitradar.fun/` — landing + live feed (demo)
- `/leaderboard` — top realized profit
- `/wallet/<any-address>` and `/token/<any-mint>` — render deterministic demo data
- Paste a `/token/...` link into X or Telegram → the per-token share card preview shows up

## Going live against the backend

Once `apps/api` + `apps/worker` are running (see `DEPLOY-VPS.md`) behind TLS:

1. Set `NEXT_PUBLIC_API_URL=https://api.exitradar.fun` and
   `NEXT_PUBLIC_API_WS_URL=wss://api.exitradar.fun/ws` in Vercel.
2. Redeploy. The feed, leaderboard, wallet and token pages now serve real on-chain data —
   no code change. ⚠️ A Vercel HTTPS site can only open a **`wss://`** socket (needs TLS on the
   API), not `ws://<ip>`.
