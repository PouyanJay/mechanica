#!/usr/bin/env bash
# scripts/build.sh — compile the production bundle (browser assets + worker).
#
# Wired to `make build`. Output lands in dist/.

set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib/ui.sh
ui::init
ui::banner "make build" "Building the production bundle into dist/"

ui::step 1 1 "Production build"
if [ ! -d node_modules ]; then
  ui::die "node_modules is missing" "run: make setup"
fi
if ! ui::run "vinext build" "npm run build:local"; then
  ui::die "build failed" "inspect the output above"
fi

size="$(du -sh dist 2>/dev/null | awk '{print $1}')"
ui::summary_begin "Build Summary"
ui::summary_row "output" "dist/ ($size)" "ok"
ui::summary_end
ui::info "serve it locally with: npm run start:local"
