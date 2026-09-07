#!/usr/bin/env bash
# scripts/run-linters.sh: run code quality tools for Mechanica.
#
# Wired to `make lint` / `make lint-fix`.
#
# Flags:
#   (none)      Check mode: report issues, non-zero exit on failure
#   --fix       Auto-fix what eslint can, then re-check the rest
#   -h, --help  Usage

set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib/ui.sh
ui::init

ESLINT_ARGS=". --ignore-pattern dist --ignore-pattern .next"

fix=0
case "${1:-}" in
  "") ;;
  --fix) fix=1 ;;
  -h|--help)
    ui::banner "scripts/run-linters.sh" "Lint runner"
    ui::section "Usage"
    ui::cmd "./scripts/run-linters.sh" "Check mode (report only)"
    ui::cmd "./scripts/run-linters.sh --fix" "Auto-fix, then re-check"
    echo ""
    exit 0
    ;;
  *)
    echo "unknown flag: $1 (see --help)" >&2
    exit 1
    ;;
esac

if [ ! -d node_modules ]; then
  ui::banner "make lint" "Linting Mechanica"
  ui::die "node_modules is missing" "run: make setup"
fi

aggregate=0
eslint_result="pass"

if [ "$fix" -eq 1 ]; then
  ui::banner "make lint-fix" "Auto-fixing lint issues, then re-checking"
  ui::step 1 2 "eslint --fix"
  ui::run "eslint --fix" "npx eslint $ESLINT_ARGS --fix" || true
  ui::step 2 2 "eslint (verify)"
  if ! ui::run "eslint" "npx eslint $ESLINT_ARGS"; then
    eslint_result="FAIL"
    aggregate=1
    ui::hint "remaining issues need manual fixes"
  fi
else
  ui::banner "make lint" "Linting Mechanica"
  ui::step 1 1 "eslint"
  if ! ui::run "eslint" "npx eslint $ESLINT_ARGS"; then
    eslint_result="FAIL"
    aggregate=1
    ui::hint "try: make lint-fix"
  fi
fi

ui::summary_begin "Lint Summary"
if [ "$eslint_result" = "pass" ]; then
  ui::summary_row "eslint" "$eslint_result" "ok"
else
  ui::summary_row "eslint" "$eslint_result" "fail"
fi
ui::summary_end

exit "$aggregate"
