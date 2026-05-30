#!/usr/bin/env bash
#
# ProfitFlow — safe deploy
# ========================
# Deploys the contents of THIS git repo into an isolated directory on the
# server, WITHOUT disturbing the other PM2 services already running there
# (gateway, ingest, enrich, payments, bot, alerts, web).
#
# Strategy (no blind deletes, instant rollback):
#   1. Snapshot the current deploy + `pm2 save`           -> backup
#   2. Export the exact tracked files of HEAD into a new   -> clean release
#      timestamped release dir via `git archive`
#   3. Install deps (if any) + run the PnL engine tests    -> smoke test
#   4. Atomically flip the `current` symlink to the release
#   5. Prune old releases, keeping the last $KEEP_RELEASES
#   6. (optional) start/reload ONLY our own PM2 app
#
# The old files are replaced (clean cut-over), but nothing is lost: every
# previous release stays under releases/ and a tarball is kept under backups/.
#
# Usage — run from a clean checkout on the server:
#   git pull && ./deploy/deploy.sh
#   DEPLOY_ROOT=/opt/profitflow PM2_APP=profitflow-landing ./deploy/deploy.sh
#   ./deploy/deploy.sh --rollback        # flip back to the previous release
#   ./deploy/deploy.sh --yes             # skip the confirmation prompt (CI)
#
set -Eeuo pipefail

# --- config (override via env) ----------------------------------------------
APP_NAME="${APP_NAME:-profitflow}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/profitflow}"   # holds releases/ current backups/
KEEP_RELEASES="${KEEP_RELEASES:-5}"
RUN_TESTS="${RUN_TESTS:-1}"
PM2_APP="${PM2_APP:-}"                # e.g. profitflow-landing; empty => skip pm2
ASSUME_YES="${ASSUME_YES:-0}"         # 1 (or CI=true) => no prompt
# ----------------------------------------------------------------------------

RELEASES_DIR="$DEPLOY_ROOT/releases"
CURRENT_LINK="$DEPLOY_ROOT/current"
BACKUPS_DIR="$DEPLOY_ROOT/backups"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log()  { printf '\033[1;32m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

confirm() {
  [[ "$ASSUME_YES" == "1" || "${CI:-}" == "true" ]] && return 0
  read -r -p "$1 [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]]
}

reload_pm2() {
  [[ -n "$PM2_APP" ]] || { warn "PM2_APP not set — skipping pm2 (start it yourself when ready)"; return 0; }
  command -v pm2 >/dev/null || { warn "pm2 not found on PATH — skipping pm2 step"; return 0; }
  if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
    log "pm2 reload $PM2_APP"
    ( cd "$CURRENT_LINK" && pm2 reload ecosystem.config.js --only "$PM2_APP" --update-env )
  else
    log "pm2 start $PM2_APP"
    ( cd "$CURRENT_LINK" && pm2 start ecosystem.config.js --only "$PM2_APP" )
  fi
  pm2 save || true
  return 0
}

rollback() {
  [[ -d "$RELEASES_DIR" ]] || die "no releases dir at $RELEASES_DIR — nothing to roll back to"
  local prev
  prev="$(ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | sed -n '2p' || true)"
  [[ -n "$prev" ]] || die "no previous release to roll back to"
  prev="${prev%/}"
  log "rolling back: current -> $prev"
  ln -sfn "$prev" "$CURRENT_LINK.tmp" && mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"
  reload_pm2
  log "rollback complete."
  exit 0
}

backup_existing() {
  mkdir -p "$BACKUPS_DIR"
  local bk="$BACKUPS_DIR/backup-$TS.tar.gz"
  if [[ -L "$CURRENT_LINK" ]]; then
    local tgt; tgt="$(readlink -f "$CURRENT_LINK")"
    log "backing up live release -> $bk"
    tar -czf "$bk" -C "$(dirname "$tgt")" "$(basename "$tgt")"
  elif [[ -d "$DEPLOY_ROOT" ]] && find "$DEPLOY_ROOT" -mindepth 1 -maxdepth 1 \
        ! -name releases ! -name backups ! -name current 2>/dev/null | read -r _; then
    log "backing up existing files in $DEPLOY_ROOT -> $bk"
    tar -czf "$bk" -C "$DEPLOY_ROOT" --exclude=./releases --exclude=./backups --exclude=./current .
  else
    warn "no existing deploy to back up (fresh install)"
  fi
  command -v pm2 >/dev/null && { log "pm2 save (snapshot process list)"; pm2 save || true; }
  return 0   # never let a missing pm2 (the && above) trip `set -e`
}

# --- arg parsing ------------------------------------------------------------
DO_ROLLBACK=0
for arg in "$@"; do
  case "$arg" in
    --rollback) DO_ROLLBACK=1 ;;
    --yes|-y)   ASSUME_YES=1 ;;
    --help|-h)  sed -n '2,33p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)          die "unknown arg: $arg (try --help)" ;;
  esac
done

[[ "$DO_ROLLBACK" == "1" ]] && rollback

# --- pre-flight -------------------------------------------------------------
command -v git  >/dev/null || die "git not installed"
command -v node >/dev/null || die "node not installed"
command -v tar  >/dev/null || die "tar not installed"
git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || die "run this from inside the git checkout of the repo"

REV="$(git -C "$REPO_DIR" rev-parse --short HEAD)"
BRANCH="$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD)"
TS="$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="$RELEASES_DIR/$TS-$REV"

cat <<EOF

  App         : $APP_NAME
  Deploy root : $DEPLOY_ROOT
  Source      : $REPO_DIR  ($BRANCH @ $REV)
  New release : $RELEASE_DIR
  PM2 app     : ${PM2_APP:-<none — pm2 step skipped>}

  This deploys ONLY this repo into its own directory. It does NOT touch your
  other PM2 services (gateway, ingest, enrich, payments, bot, alerts, web).
  Point DEPLOY_ROOT at a DEDICATED dir — never at the folder holding those
  services.
EOF
confirm "Proceed with deploy?" || die "aborted by user"

mkdir -p "$RELEASES_DIR" "$BACKUPS_DIR"

# --- 1. backup --------------------------------------------------------------
backup_existing

# --- 2. clean release via git archive ---------------------------------------
log "exporting tracked files of $REV -> $RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
# If anything below fails, scrub the half-built release. `current` is only
# touched in step 4, so a failure here never affects what is live.
trap 'rc=$?; if [[ $rc -ne 0 ]]; then warn "deploy failed (rc=$rc) — removing partial release"; rm -rf "$RELEASE_DIR"; fi' EXIT
git -C "$REPO_DIR" archive HEAD | tar -x -C "$RELEASE_DIR"

# --- 3. build + smoke test --------------------------------------------------
if [[ -f "$RELEASE_DIR/pnl-validation/package.json" ]]; then
  if command -v npm >/dev/null && grep -q '"dependencies"' "$RELEASE_DIR/pnl-validation/package.json"; then
    log "installing pnl-validation deps"
    ( cd "$RELEASE_DIR/pnl-validation" && npm ci --omit=dev --no-audit --no-fund 2>/dev/null \
        || npm install --omit=dev --no-audit --no-fund ) || warn "dep install reported errors (continuing)"
  fi
  if [[ "$RUN_TESTS" == "1" ]]; then
    log "running PnL engine tests (smoke test)"
    ( cd "$RELEASE_DIR/pnl-validation" && node pnl-engine.test.js ) \
      || die "smoke tests FAILED — not switching. Partial release removed, live deploy untouched."
  fi
fi

# --- 4. atomic cut-over -----------------------------------------------------
log "switching current -> $RELEASE_DIR"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK.tmp"
mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"
trap - EXIT   # success: keep the release

# --- 5. prune old releases --------------------------------------------------
log "pruning old releases (keeping $KEEP_RELEASES)"
live="$(readlink -f "$CURRENT_LINK")"
ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
  [[ "$(readlink -f "$old")" == "$live" ]] && continue
  rm -rf "$old"
done

# --- 6. pm2 -----------------------------------------------------------------
reload_pm2

log "done. live: $CURRENT_LINK -> $live"
printf '  rollback any time with:  %s/deploy/deploy.sh --rollback\n' "$REPO_DIR"
