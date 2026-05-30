# Deploy ProfitFlow on a VPS

Run the ProfitFlow **backend** (api + worker + bot) on your own server. The **web frontend** goes
to Vercel (see `DEPLOY-VERCEL.md` / the root README). Two paths below — **Docker Compose**
(recommended, brings its own Postgres + Redis) or **pm2** (matches a typical existing setup).

> Run these on the VPS yourself. Steps marked ⚠️ **delete things** — read them before pasting.

## 0. Prerequisites — Node 22 is required

pnpm/corepack needs **Node ≥ 22**. If `node -v` shows v20 or lower you'll hit
`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` — install Node 22 LTS first (NodeSource, system-wide,
plays nicely with pm2):

```bash
node -v                                   # if < v22, do the next two lines:
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pm2                         # re-ensure pm2 on the new Node
node -v ; git --version                    # node should now be v22.x
```

## 1. ⚠️ Remove the old app safely (don't blind-`rm`)

```bash
pm2 describe fourtis-backend          # note "script path" + "exec cwd" = where its files live
tar -czf ~/backup-fourtis-$(date +%F).tar.gz <OLD_FOLDER>   # back it up first
pm2 stop fourtis-backend && pm2 delete fourtis-backend && pm2 save
ls <OLD_FOLDER>                        # confirm it's really the old app
rm -rf <OLD_FOLDER>                    # only after you've confirmed
```

## 2. Get the code

Private repo → authenticate with a GitHub token (or an SSH deploy key):

```bash
git clone -b claude/stoic-meitner-ZyOG9 https://<GITHUB_USER>:<TOKEN>@github.com/fourtisf/profitflow.git
cd profitflow
```

## 3a. Run with Docker Compose (recommended)

Brings up **api + worker + bot + Postgres + Redis** in one command, isolated from anything else.

```bash
docker compose up -d --build
docker compose ps
curl localhost:4000/health            # {"ok":true,"source":"sim",...}
```

Demo (sim) mode by default. To go **live**, create a `.env` next to `docker-compose.yml`:

```env
DATA_SOURCE=helius
HELIUS_API_KEY=...
BIRDEYE_API_KEY=...        # per-timestamp SOL price (don't ship a flat price)
TELEGRAM_BOT_TOKEN=...     # optional
TELEGRAM_CHAT_ID=...
```

then `docker compose up -d --build` again, and apply the DB schema once:

```bash
docker compose exec worker sh -c 'echo set DATABASE_URL and run: pnpm --filter @profitflow/worker prisma:push'
```

## 3b. Or run with pm2 (no DB needed in sim mode)

> Make sure you are **inside the cloned `profitflow/` folder** (where `ecosystem.config.cjs` is).
> Running these from `~` is why you'd see "File ecosystem.config.cjs not found".

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @profitflow/api --filter @profitflow/worker --filter @profitflow/bot build
pm2 start ecosystem.config.cjs && pm2 save
pm2 logs profitflow-api
curl localhost:4000/health
```

Edit env (keys, DATA_SOURCE) in `ecosystem.config.cjs`, then `pm2 restart all --update-env`.

## 4. Expose it

```bash
# quick test from outside (open the port):
ufw allow 4000/tcp
# then: http://<SERVER_IP>:4000/health
```

**Production:** put Nginx + TLS in front (see [`nginx.conf`](./nginx.conf)) and point a subdomain
(e.g. `api.exitradar.fun`) at it via Cloudflare.

## 5. Connect the Vercel web app

In Vercel → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_API_URL    = https://api.<domain>
NEXT_PUBLIC_API_WS_URL = wss://api.<domain>/ws
```

> ⚠️ **Mixed content:** a Vercel site served over **HTTPS cannot** open an insecure `ws://<ip>`.
> The live WebSocket feed needs **`wss://`**, which needs **Nginx + TLS + a domain**. Until the
> domain is set up, leave these unset — the Vercel site stays alive in **demo mode** (in-browser
> sim). The VPS API still works for direct testing at `http://<ip>:4000`.

## Updating later

```bash
git pull
docker compose up -d --build          # Docker path
# or:
pnpm install && pnpm --filter @profitflow/api --filter @profitflow/worker --filter @profitflow/bot build && pm2 restart all
```
