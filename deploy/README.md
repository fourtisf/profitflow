# Deploy

Safe, repeatable deployment of this repo onto the server **without disturbing
the other PM2 services** that already run there (`gateway`, `ingest`, `enrich`,
`payments`, `bot`, `alerts`, `web`).

> ⚠️ **This repo is not those services.** It contains the landing page and the
> realized-PnL validation kit only. Do **not** delete the server's existing app
> directory to "upload" this — that would wipe your running deployment. This
> script deploys into a **separate, dedicated** directory instead.

## What `deploy.sh` does

1. **Backs up** the current deploy (tarball under `backups/`) and runs `pm2 save`.
2. Exports the exact tracked files of `HEAD` (`git archive`) into a fresh,
   timestamped `releases/<ts>-<rev>/` directory — no stray/untracked files.
3. Runs the **PnL engine tests** as a smoke test (14 tests, no API key needed).
   If they fail, it stops and **does not** switch — the live deploy is untouched.
4. **Atomically** flips a `current` symlink to the new release (clean cut-over:
   old files replaced, previous releases retained for rollback).
5. Prunes old releases, keeping the last `KEEP_RELEASES` (default 5).
6. Optionally starts/reloads **only** the `profitflow-landing` PM2 app.

Resulting layout on the server:

```
$DEPLOY_ROOT/
├── current -> releases/20260530-2100-ab12cd3   # atomic symlink
├── releases/
│   ├── 20260530-2100-ab12cd3/                   # this deploy
│   └── 20260530-2030-9f0e1a2/                   # previous (rollback target)
└── backups/
    └── backup-20260530-2100.tar.gz
```

## Run it on the server

```bash
# 1) Get the code on the VPS (keep the source checkout separate from the
#    deploy root so the releases/ layout stays clean).
sudo mkdir -p /opt && cd /opt
git clone https://github.com/fourtisf/profitflow.git profitflow-src   # first time
cd profitflow-src
git fetch origin
git checkout claude/inspiring-allen-CEIo2
git pull --ff-only origin claude/inspiring-allen-CEIo2

# 2) Deploy (backs up, smoke-tests, atomic switch; never touches other services)
chmod +x deploy/deploy.sh
DEPLOY_ROOT=/opt/profitflow PM2_APP=profitflow-landing ./deploy/deploy.sh

# 3) First time only: make pm2 survive reboots
pm2 save
pm2 startup        # then run the command it prints
```

## Rollback

```bash
DEPLOY_ROOT=/opt/profitflow PM2_APP=profitflow-landing ./deploy/deploy.sh --rollback
```

Flips `current` back to the previous release and reloads PM2. Older releases and
the `backups/` tarballs are always there if you need to go further back.

## Configuration (env vars)

| Var | Default | Meaning |
| --- | --- | --- |
| `DEPLOY_ROOT` | `/opt/profitflow` | Dedicated dir for `releases/ current backups/`. **Never** point at the folder holding your other services. |
| `PM2_APP` | _(empty)_ | PM2 app to start/reload, e.g. `profitflow-landing`. Empty = skip PM2 (just stage files). |
| `KEEP_RELEASES` | `5` | How many old releases to retain. |
| `RUN_TESTS` | `1` | Run the smoke test before switching (`0` to skip). |
| `ASSUME_YES` | `0` | `1` (or `CI=true`) skips the confirmation prompt. |

Flags: `--rollback`, `--yes`/`-y`, `--help`.

## The landing-page app (optional)

`ecosystem.config.js` defines a single app, `profitflow-landing`, that serves
`landing-page/profitflow.html` via a zero-dependency Node server
(`deploy/static-server.js`) on port `8080`.

- It is **separate** from your existing `web` PM2 process, so it won't clobber it.
- The page uses **simulated** data — it's a demo, not live (see `HANDOFF.md`).
- To keep it internal (behind your reverse proxy), set `HOST=127.0.0.1` in
  `ecosystem.config.js`. To change the port, edit `PORT` there.

Start it standalone (without the deploy script):

```bash
pm2 start ecosystem.config.js --only profitflow-landing
```
