#!/usr/bin/env bash
# scripts/help.sh: render the formatted `make help` reference.
#
# Wired by the Makefile's default `help` target. Lists every target the
# Makefile defines; keep it in sync whenever a target is added or removed.

set -euo pipefail

source "$(dirname "$0")/lib/ui.sh"

ui::_logo
printf "\n  %s%smechanica%s %s· make targets · interactive 3D atlas of seven engines%s\n" \
  "${UI_BOLD}" "${UI_PRIMARY}" "${UI_RESET}" \
  "${UI_DIM}" "${UI_RESET}"

ui::section "Help"
ui::cmd "make help"          "Print this command reference (default)"

ui::section "Setup & Run"
ui::cmd "make setup"         "Install dev dependencies (node check + npm ci), idempotent"
ui::cmd "make start"         "Start the dev server (background, health-gated, prints URL)"
ui::cmd "make run"           "Bulletproof end-to-end: setup + start"
ui::cmd "make stop"          "Stop the dev server"
ui::cmd "make logs"          "Tail the dev server log"

ui::section "Build"
ui::cmd "make build"         "Production build (browser assets + worker) into dist/"

ui::section "Testing"
ui::cmd "make test"          "All suites: engine model checks + build + UI tests"
ui::cmd "make test-engines"  "Numeric checks for all seven engines (fast, no build)"
ui::cmd "make test-ui"       "Build, then rendered-HTML and UI component tests"

ui::section "Linting"
ui::cmd "make lint"          "Run eslint"
ui::cmd "make lint-fix"      "Auto-fix lint issues, then re-check"

ui::section "Housekeeping"
ui::cmd "make clean"         "Stop server; remove dist, .wrangler, .run-state"

printf "\n  %sThe app needs a WebGL2-capable browser; no API key, database, or%s\n" "${UI_DIM}" "${UI_RESET}"
printf "  %scloud account is required locally.%s\n\n" "${UI_DIM}" "${UI_RESET}"
