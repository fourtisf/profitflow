# Deploy the ExitRadar web app (Next.js) on the VPS

The web app (`apps/web`) is **separate** from the static landing (`profitflow-landing`, :8080).
Unlike the static site, it can't go through `deploy.sh` (that uses `git archive` — no install/build).
A Next.js app needs: **pnpm install → next build → run under pm2 → nginx proxy**.

> Runs in **demo mode** (in-browser simulation) until you set `NEXT_PUBLIC_API_URL`, so it works
> standalone right now — no backend, DB, or keys required.

Prereqs: Node ≥ 22 (`node -v`) and pnpm (`corepack enable`). Run everything on the VPS.

## 1. Build (in the git clone, NOT a release dir)

```bash
cd /opt/profitflow-src
git fetch origin
git checkout -B claude/great-shannon-FGnU0 origin/claude/great-shannon-FGnU0
corepack enable
pnpm install --frozen-lockfile

# NEXT_PUBLIC_* are baked in at BUILD time — set the public URL here.
# Subdomain (recommended): https://app.exitradar.fun   |   Replacing the landing: https://exitradar.fun
NEXT_PUBLIC_SITE_URL=https://app.exitradar.fun pnpm --filter @profitflow/web build
```

> Small VPS? If the build is killed (OOM), add swap or prefix the build with
> `NODE_OPTIONS=--max-old-space-size=1024`.

## 2. Run under pm2 (port 3000)

```bash
cd /opt/profitflow-src/apps/web
pm2 start npm --name profitflow-web -- run start   # npm run start -> next start -p 3000
pm2 save
pm2 logs profitflow-web --lines 5                  # should show "Ready on http://localhost:3000"
```

**Quick check (no domain needed yet):**
```bash
sudo ufw allow 3000/tcp        # if a firewall is on
curl -s localhost:3000/leaderboard | grep -o leaderboard | head -1
```
Then open `http://<VPS_IP>:3000/` and `…/leaderboard`, `…/wallet/<anything>`, `…/token/<anything>`.

## 3. Put it behind a domain + HTTPS

Pick ONE.

### Option A — subdomain `app.exitradar.fun` (recommended; keeps the static landing)

1. DNS: add an **A record** `app` → your VPS IP (registrar / Cloudflare; if Cloudflare, grey-cloud it for certbot, or use DNS-01).
2. Install the proxy config (committed at `deploy/nginx-web.conf`):
   ```bash
   sudo cp /opt/profitflow-src/deploy/nginx-web.conf /etc/nginx/conf.d/exitradar-web.conf
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d app.exitradar.fun          # adds HTTPS + auto-renew
   ```
3. Open `https://app.exitradar.fun/`.

### Option B — replace the landing at `exitradar.fun`

Rebuild step 1 with `NEXT_PUBLIC_SITE_URL=https://exitradar.fun`, then in your existing
`exitradar.fun` nginx server block change `proxy_pass`/root from the static server (`:8080`)
to `proxy_pass http://127.0.0.1:3000;` (+ the `Upgrade`/`Connection` headers from `nginx-web.conf`),
`nginx -t && systemctl reload nginx`. (Leaves `profitflow-landing` running but unreferenced.)

## 4. Updating later

```bash
cd /opt/profitflow-src
git pull origin claude/great-shannon-FGnU0
pnpm install --frozen-lockfile
NEXT_PUBLIC_SITE_URL=https://app.exitradar.fun pnpm --filter @profitflow/web build
pm2 restart profitflow-web
```

## Going live against the backend (later)

When `apps/api` + `apps/worker` run with Helius/Redis/Postgres, rebuild with
`NEXT_PUBLIC_API_URL=https://api.exitradar.fun` and `NEXT_PUBLIC_API_WS_URL=wss://api.exitradar.fun/ws`
set on the build command. The feed, leaderboard, wallet & token pages then show real on-chain data.
