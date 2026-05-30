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
6. Optionally reloads a release-pinned PM2 app (`PM2_APP`). **For the landing
   page, do not use this** — instead run the server so it follows the `current`
   symlink (see below), so deploys are picked up with no restart at all.

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

The server process serves the **`current` symlink** — so a deploy just flips
`current` and the change is live instantly, **no restart needed**. The process
must be started once from the stable source checkout (not from a release dir, or
it gets pinned to that one release and never sees later deploys).

```bash
# 1) Source checkout (keep separate from the deploy root)
cd /opt
git clone https://github.com/fourtisf/profitflow.git profitflow-src   # first time
cd profitflow-src && git checkout claude/inspiring-allen-CEIo2
git pull --ff-only origin claude/inspiring-allen-CEIo2

# 2) Deploy: build a release + flip `current`. NOTE: no PM2_APP — the running
#    server already follows `current`, so it picks this up with no restart.
chmod +x deploy/deploy.sh
DEPLOY_ROOT=/opt/profitflow ./deploy/deploy.sh

# 3) Start the landing server ONCE, pointed at the `current` symlink, run from
#    the (stable) source checkout so its script path is never pruned.
HOST=0.0.0.0 PORT=8080 STATIC_DIR=/opt/profitflow/current/landing-page \
  pm2 start deploy/static-server.js --name profitflow-landing --update-env

# 4) Optional API (needs a Helius key; bind locally, behind nginx)
HELIUS_API_KEY=xxx HOST=127.0.0.1 PORT=8090 \
  pm2 start pnl-validation/server.js --name profitflow-api --update-env

# 5) Persist across reboots
pm2 save
pm2 startup        # then run the command it prints
```

> ⚠️ **Do not** start the landing app with `PM2_APP=profitflow-landing
> ./deploy/deploy.sh`. That launches the server *inside a release directory*, so
> PM2 pins it to that release — later deploys flip `current` but the server keeps
> serving the old files. Always serve `current` as in step 3.

## Rollback

```bash
DEPLOY_ROOT=/opt/profitflow ./deploy/deploy.sh --rollback
```

Flips `current` back to the previous release — and because the server follows
`current`, the rollback is live instantly. Older releases and the `backups/`
tarballs are always there if you need to go further back.

## Configuration (env vars)

| Var | Default | Meaning |
| --- | --- | --- |
| `DEPLOY_ROOT` | `/opt/profitflow` | Dedicated dir for `releases/ current backups/`. **Never** point at the folder holding your other services. |
| `PM2_APP` | _(empty)_ | Release-pinned PM2 app to reload. **Leave empty for the landing page** — its server follows `current` and needs no per-deploy restart. |
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
- To keep it internal (behind your reverse proxy), set `HOST=127.0.0.1`.

**Always point `STATIC_DIR` at the `current` symlink** (absolute path) and start
the script from the source checkout, so the server follows every deploy:

```bash
cd /opt/profitflow-src
HOST=0.0.0.0 PORT=8080 STATIC_DIR=/opt/profitflow/current/landing-page \
  pm2 start deploy/static-server.js --name profitflow-landing --update-env
```

`static-server.js` honors an absolute `STATIC_DIR` (it's resolved as-is), and it
opens files per request — so when a deploy flips `current`, the next request
already serves the new release with no restart.
