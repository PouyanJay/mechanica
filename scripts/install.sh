#!/usr/bin/env bash
# scripts/install.sh: one-command dev environment setup for Mechanica.
#
# Wired to `make setup`. Idempotent: checks state before acting, skips what is
# already in place, and re-runs `npm ci` only when package-lock.json changed.

set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib/ui.sh
ui::init
ui::banner "make setup" "Installing the Mechanica developer environment"

TOTAL=3
REQUIRED_NODE_MAJOR=22
REQUIRED_NODE_MINOR=13

STATE_DIR=".run-state"
STAMP="$STATE_DIR/npm-ci.stamp"

node_status="missing"
npm_status="missing"
deps_status="fail"

# ── 1/3 Hard prerequisites ───────────────────────────────────────────────────
ui::step 1 "$TOTAL" "Hard prerequisites"

if command -v node >/dev/null 2>&1; then
  node_version="$(node -v)"
  ver="${node_version#v}"
  major="${ver%%.*}"
  rest="${ver#*.}"
  minor="${rest%%.*}"
  if [ "$major" -gt "$REQUIRED_NODE_MAJOR" ] || {
    [ "$major" -eq "$REQUIRED_NODE_MAJOR" ] && [ "$minor" -ge "$REQUIRED_NODE_MINOR" ]
  }; then
    ui::ok "node"
    ui::detail "$node_version (>= ${REQUIRED_NODE_MAJOR}.${REQUIRED_NODE_MINOR} required)"
    node_status="$node_version"
  else
    ui::die "node $node_version is too old (need >= ${REQUIRED_NODE_MAJOR}.${REQUIRED_NODE_MINOR})" \
      "nvm install 22   # or: brew install node"
  fi
else
  ui::die "node is not installed" \
    "brew install node   # or: https://nodejs.org (>= 22.13)"
fi

if command -v npm >/dev/null 2>&1; then
  npm_version="$(npm -v)"
  ui::ok "npm"
  ui::detail "v$npm_version"
  npm_status="v$npm_version"
else
  ui::die "npm is not installed (usually ships with node)" \
    "reinstall node: brew install node"
fi

# ── 2/3 Project dependencies ─────────────────────────────────────────────────
ui::step 2 "$TOTAL" "Project dependencies"

mkdir -p "$STATE_DIR"
lock_hash="$(shasum -a 256 package-lock.json | awk '{print $1}')"

if [ -d node_modules ] && [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$lock_hash" ]; then
  ui::skip "npm ci: node_modules already matches package-lock.json"
  deps_status="up to date"
else
  if ui::run "npm ci (clean install from package-lock.json)" "npm ci"; then
    printf "%s" "$lock_hash" >"$STAMP"
    deps_status="installed"
  else
    ui::die "dependency installation failed" \
      "inspect the output above, then rerun: make setup"
  fi
fi

# ── 3/3 Verification ─────────────────────────────────────────────────────────
ui::step 3 "$TOTAL" "Verification"

vite_status="fail"
if [ -x node_modules/.bin/vite ]; then
  ui::ok "vite"
  vite_status="$(node_modules/.bin/vite --version 2>/dev/null || echo present)"
  ui::detail "$vite_status"
else
  ui::die "node_modules/.bin/vite is missing after install" \
    "rm -rf node_modules && make setup"
fi

vinext_status="fail"
if [ -x node_modules/.bin/vinext ]; then
  ui::ok "vinext"
  vinext_status="present"
else
  ui::die "node_modules/.bin/vinext is missing after install" \
    "rm -rf node_modules && make setup"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
ui::summary_begin "Installation Summary"
ui::summary_row "node" "$node_status" "ok"
ui::summary_row "npm" "$npm_status" "ok"
if [ "$deps_status" = "up to date" ]; then
  ui::summary_row "dependencies" "$deps_status" "skip"
else
  ui::summary_row "dependencies" "$deps_status" "ok"
fi
ui::summary_row "vite" "$vite_status" "ok"
ui::summary_row "vinext" "$vinext_status" "ok"
ui::summary_end

ui::info "next: make start (or make run for setup + start in one go)"
