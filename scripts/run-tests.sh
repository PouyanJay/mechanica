#!/usr/bin/env bash
# scripts/run-tests.sh: run any or all Mechanica test suites.
#
# Wired to `make test` / `make test-engines` / `make test-ui`.
#
# Flags:
#   --all       Engine model checks + UI/HTML tests (default)
#   --engines   Numeric checks for all seven engine models (fast, no build)
#   --ui        Build, then rendered-HTML and UI component tests
#   -h, --help  Usage
#
# Never exits on the first failure: every selected suite runs, results are
# aggregated, and the exit code is the OR of all suite exit codes.

set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib/ui.sh
ui::init

run_engines=0
run_ui=0

case "${1:---all}" in
  --all) run_engines=1; run_ui=1 ;;
  --engines) run_engines=1 ;;
  --ui) run_ui=1 ;;
  -h|--help)
    ui::banner "scripts/run-tests.sh" "Test runner"
    ui::section "Usage"
    ui::cmd "./scripts/run-tests.sh --all" "Engine checks + UI tests (default)"
    ui::cmd "./scripts/run-tests.sh --engines" "Engine model checks only (fast)"
    ui::cmd "./scripts/run-tests.sh --ui" "Build + rendered-HTML/component tests"
    echo ""
    exit 0
    ;;
  *)
    echo "unknown flag: $1 (see --help)" >&2
    exit 1
    ;;
esac

# The UI suite counts as two steps: the build it needs, then the tests.
total=$((run_engines + run_ui * 2))
step=0
engines_result="skipped"
build_result="skipped"
ui_result="skipped"
aggregate=0

ui::banner "make test" "Running the Mechanica test suites"

if [ "$run_engines" -eq 1 ]; then
  step=$((step + 1))
  ui::step "$step" "$total" "Engine model checks (all seven engines)"
  if ui::run "scripts/check-explosion.mjs" "node scripts/check-explosion.mjs"; then
    engines_result="pass"
  else
    engines_result="FAIL"
    aggregate=1
  fi
fi

if [ "$run_ui" -eq 1 ]; then
  step=$((step + 1))
  ui::step "$step" "$total" "Production build (required by UI tests)"
  if ui::run "vinext build" "npm run build:local"; then
    build_result="pass"
  else
    build_result="FAIL"
    aggregate=1
  fi

  step=$((step + 1))
  ui::step "$step" "$total" "Rendered HTML + UI component tests"
  if [ "$build_result" = "FAIL" ]; then
    ui::skip "skipped: the build they test against failed"
    ui_result="skipped (build failed)"
  elif ui::run "node --test tests/*.test.mjs" \
    "node --test tests/rendered-html.test.mjs tests/ui-components.test.mjs"; then
    ui_result="pass"
  else
    ui_result="FAIL"
    aggregate=1
  fi
fi

ui::summary_begin "Test Summary"
case "$engines_result" in
  pass) ui::summary_row "engine checks" "$engines_result" "ok" ;;
  FAIL) ui::summary_row "engine checks" "$engines_result" "fail" ;;
  *)    ui::summary_row "engine checks" "$engines_result" "skip" ;;
esac
case "$build_result" in
  pass) ui::summary_row "build" "$build_result" "ok" ;;
  FAIL) ui::summary_row "build" "$build_result" "fail" ;;
  *)    ui::summary_row "build" "$build_result" "skip" ;;
esac
case "$ui_result" in
  pass) ui::summary_row "ui tests" "$ui_result" "ok" ;;
  FAIL) ui::summary_row "ui tests" "$ui_result" "fail" ;;
  *)    ui::summary_row "ui tests" "$ui_result" "skip" ;;
esac
ui::summary_end

exit "$aggregate"
