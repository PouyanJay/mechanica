#!/usr/bin/env bash
# scripts/lib/ui.sh: shared output library for Mechanica scripts.
#
# Provides a consistent visual language for every Makefile-dispatched script:
# a block-letter MECHANICA banner with a crankshaft-and-gear motif, coloured
# output (with TTY/CI detection), Unicode icons (with ASCII fallback), a
# numbered step tracker, status helpers (ok/warn/fail/skip/info) that nest
# UNDER the current step, hint/detail sub-lines for parent→child reporting, a
# spinner, a safe command executor (ui::run) that confines failure output to a
# bordered card, and a summary dashboard for end-of-script reporting.
#
# Compatibility target: Bash 3.2 (stock macOS bash). Do NOT use:
#   - associative arrays (`declare -A`)
#   - parameter expansion uppercasing (`${var^^}`)
#   - `[[ =~ ]]` capture groups (BASH_REMATCH is unreliable in 3.2)
#
# Usage:
#   source "$(dirname "$0")/lib/ui.sh"
#   ui::init                       # installs traps that clean up the spinner
#   ui::banner "make setup" "Installing the Mechanica developer environment"
#   ui::step 1 3 "Hard prerequisites"
#   ui::ok "node"; ui::detail "v24.1.0"
#   ui::run "npm ci" "npm ci"
#   ui::summary_begin "Installation Summary"
#   ui::summary_row "node" "v24.1.0" "ok"
#   ui::summary_end
#
# Respect:
#   NO_COLOR=1       disables all ANSI colour
#   FORCE_COLOR=1    forces colour even when not a TTY
#   TERM=dumb        disables colour (terminal does not support it)
#   non-TTY stdout   disables colour AND spinner; shows plain text

# --- Guard against double-sourcing -------------------------------------------
if [ -n "${_MECHANICA_UI_SH_LOADED:-}" ]; then
  return 0 2>/dev/null || exit 0
fi
_MECHANICA_UI_SH_LOADED=1

# --- Capability detection ----------------------------------------------------

ui::_supports_color() {
  [ -n "${FORCE_COLOR:-}" ] && return 0
  [ -n "${NO_COLOR:-}" ] && return 1
  [ -t 1 ] || return 1
  case "${TERM:-}" in
    dumb|"") return 1 ;;
    *) return 0 ;;
  esac
}

ui::_supports_unicode() {
  case "${LC_ALL:-${LC_CTYPE:-${LANG:-}}}" in
    *UTF-8*|*utf-8*|*UTF8*|*utf8*) return 0 ;;
    *) return 1 ;;
  esac
}

ui::_is_tty() { [ -t 1 ]; }

# --- Palette -----------------------------------------------------------------

if ui::_supports_color; then
  UI_RESET=$'\033[0m'
  UI_BOLD=$'\033[1m'
  UI_DIM=$'\033[2m'
  UI_PRIMARY=$'\033[36m'   # cyan
  UI_SUCCESS=$'\033[32m'   # green
  UI_WARN=$'\033[33m'      # yellow
  UI_ERROR=$'\033[31m'     # red
else
  UI_RESET=""
  UI_BOLD=""
  UI_DIM=""
  UI_PRIMARY=""
  UI_SUCCESS=""
  UI_WARN=""
  UI_ERROR=""
fi

# --- Icons -------------------------------------------------------------------

if ui::_supports_unicode; then
  UI_ICON_OK="✔"
  UI_ICON_FAIL="✖"
  UI_ICON_WARN="⚠"
  UI_ICON_INFO="ℹ"
  UI_ICON_SKIP="⊘"
  UI_ICON_STEP="▸"
  UI_ICON_ARROW="→"
else
  UI_ICON_OK="[ok]"
  UI_ICON_FAIL="[FAIL]"
  UI_ICON_WARN="[!]"
  UI_ICON_INFO="[i]"
  UI_ICON_SKIP="[-]"
  UI_ICON_STEP=">"
  UI_ICON_ARROW="->"
fi

# --- Internal state ----------------------------------------------------------

UI_SPINNER_PID=""
UI_BANNER_WIDTH=72

# --- Internal helpers -------------------------------------------------------

# ui::_repeat_char "char" N: emit N copies of "char". Bash 3.2 safe.
ui::_repeat_char() {
  local char="$1"
  local count="$2"
  local out=""
  local i=0
  while [ "$i" -lt "$count" ]; do
    out="${out}${char}"
    i=$((i + 1))
  done
  printf "%s" "$out"
}

# ui::_truncate "text" max: truncate with ellipsis if longer than max chars.
ui::_truncate() {
  local text="$1"
  local max="$2"
  if [ "${#text}" -gt "$max" ]; then
    if ui::_supports_unicode; then
      printf "%s…" "${text:0:$((max - 1))}"
    else
      printf "%s..." "${text:0:$((max - 3))}"
    fi
  else
    printf "%s" "$text"
  fi
}

# --- Initialization & cleanup -----------------------------------------------

# ui::init: install traps that stop any running spinner on exit/interrupt.
# Call this once at the top of every script that uses ui::run.
ui::init() {
  trap 'ui::_spinner_stop' EXIT
  trap 'ui::_spinner_stop; exit 130' INT
  trap 'ui::_spinner_stop; exit 143' TERM
}

# --- Banner ------------------------------------------------------------------

# ui::_logo: print the MECHANICA block-letter wordmark over a
# crankshaft-and-gear motif (cyan). Falls back to a plain ruled title on
# terminals without UTF-8 so CI logs stay legible.
ui::_logo() {
  if ! ui::_supports_unicode; then
    local rule
    rule="$(ui::_repeat_char "=" "$UI_BANNER_WIDTH")"
    printf "\n  %s%s%s\n" "${UI_PRIMARY}" "$rule" "${UI_RESET}"
    printf "  %s%sMECHANICA%s\n" "${UI_BOLD}" "${UI_PRIMARY}" "${UI_RESET}"
    printf "  %s%s%s\n" "${UI_PRIMARY}" "$rule" "${UI_RESET}"
    return
  fi
  printf "\n%s%s" "${UI_PRIMARY}" "${UI_BOLD}"
  printf '  ███╗   ███╗███████╗ ██████╗██╗  ██╗ █████╗ ███╗   ██╗██╗ ██████╗ █████╗ \n'
  printf '  ████╗ ████║██╔════╝██╔════╝██║  ██║██╔══██╗████╗  ██║██║██╔════╝██╔══██╗\n'
  printf '  ██╔████╔██║█████╗  ██║     ███████║███████║██╔██╗ ██║██║██║     ███████║\n'
  printf '  ██║╚██╔╝██║██╔══╝  ██║     ██╔══██║██╔══██║██║╚██╗██║██║██║     ██╔══██║\n'
  printf '  ██║ ╚═╝ ██║███████╗╚██████╗██║  ██║██║  ██║██║ ╚████║██║╚██████╗██║  ██║\n'
  printf '  ╚═╝     ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝ ╚═════╝╚═╝  ╚═╝%s\n' "${UI_RESET}"
  printf "  %s────────⚙──────────────⚙────────────────────────⚙──────────────⚙────────%s\n" \
    "${UI_DIM}" "${UI_RESET}"
}

# ui::banner "subtitle" ["context line"]: printed once at script start.
# Renders the MECHANICA wordmark, then a status line:
#
#   <MECHANICA block art>
#   ────⚙────⚙────
#   mechanica · make setup · 2026-09-07 11:36
#   Installing the Mechanica developer environment
#
ui::banner() {
  local subtitle="$1"
  local context="${2:-}"
  local ts
  ts="$(date +'%Y-%m-%d %H:%M')"

  ui::_logo
  printf "\n  %s%smechanica%s %s· %s · %s%s\n" \
    "${UI_BOLD}" "${UI_PRIMARY}" "${UI_RESET}" \
    "${UI_DIM}" "$subtitle" "$ts" "${UI_RESET}"
  if [ -n "$context" ]; then
    printf "  %s%s%s\n" "${UI_DIM}" "$context" "${UI_RESET}"
  fi
}

# --- Headers & sections ------------------------------------------------------

# ui::section "Title": dim/bold section header for grouping output.
ui::section() {
  printf "\n  %s%s%s\n" "${UI_BOLD}${UI_DIM}" "$1" "${UI_RESET}"
}

# ui::cmd "make foo" "description": formatted command-reference line.
ui::cmd() {
  printf "    %s%-24s%s %s%s%s\n" \
    "${UI_PRIMARY}" "$1" "${UI_RESET}" \
    "${UI_DIM}" "$2" "${UI_RESET}"
}

# ui::step <current> <total> "description": numbered progress step. Status
# lines (ok/warn/fail/skip/info) printed afterwards nest visually beneath it.
ui::step() {
  printf "\n%s%s %s/%s%s %s%s%s\n" \
    "${UI_PRIMARY}" "${UI_ICON_STEP}" "$1" "$2" "${UI_RESET}" \
    "${UI_BOLD}" "$3" "${UI_RESET}"
}

# --- Status lines ------------------------------------------------------------

# Indented status lines (live under the current ui::step).
ui::ok()   { printf "  %s%s%s %s\n" "${UI_SUCCESS}" "${UI_ICON_OK}"   "${UI_RESET}" "$1"; }
ui::fail() { printf "  %s%s%s %s\n" "${UI_ERROR}"   "${UI_ICON_FAIL}" "${UI_RESET}" "$1" >&2; }
ui::warn() { printf "  %s%s%s %s\n" "${UI_WARN}"    "${UI_ICON_WARN}" "${UI_RESET}" "$1"; }
ui::info() { printf "  %s%s%s %s\n" "${UI_PRIMARY}" "${UI_ICON_INFO}" "${UI_RESET}" "$1"; }
ui::skip() { printf "  %s%s %s%s\n"  "${UI_DIM}"    "${UI_ICON_SKIP}" "$1" "${UI_RESET}"; }

# ui::hint "remediation text": extra-indented secondary line under a status,
# using the arrow icon (→) to signal "next step / how to fix".
ui::hint() {
  printf "    %s%s %s%s\n" "${UI_DIM}" "${UI_ICON_ARROW}" "$1" "${UI_RESET}"
}

# ui::detail "text" [max]: indented informational sub-line under a status, for
# parent/child display (the ✔ line names the check, the detail names the
# version). Auto-truncates so verbose output stays inside the column.
ui::detail() {
  local text="$1"
  local max="${2:-66}"
  text="$(ui::_truncate "$text" "$max")"
  printf "      %s%s%s\n" "${UI_DIM}" "$text" "${UI_RESET}"
}

# ui::die "message" ["remediation hint"]: print fail + optional hint, exit 1.
ui::die() {
  ui::fail "$1"
  [ -n "${2:-}" ] && ui::hint "$2"
  exit 1
}

# --- Spinner -----------------------------------------------------------------

# ui::_spinner_start "message": animated spinner in the background.
# No-op on non-TTY (prints message inline instead).
ui::_spinner_start() {
  local msg="$1"

  if ! ui::_is_tty; then
    printf "  %s... " "$msg"
    return
  fi

  (
    local i=0
    local chars
    if ui::_supports_unicode; then
      chars=( "⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏" )
    else
      chars=( "-" "\\" "|" "/" )
    fi
    while true; do
      printf "\r  %s%s%s %s " \
        "${UI_PRIMARY}" "${chars[$((i % ${#chars[@]}))]}" "${UI_RESET}" "$msg"
      i=$((i + 1))
      sleep 0.1
    done
  ) &
  UI_SPINNER_PID=$!
  disown 2>/dev/null || true
}

# ui::_spinner_stop: stops the spinner and clears its line. Idempotent.
ui::_spinner_stop() {
  if [ -n "${UI_SPINNER_PID:-}" ]; then
    kill "$UI_SPINNER_PID" >/dev/null 2>&1 || true
    wait "$UI_SPINNER_PID" 2>/dev/null || true
    UI_SPINNER_PID=""
    if ui::_is_tty; then
      printf "\r\033[K"
    fi
  fi
}

# --- Command executor --------------------------------------------------------

# ui::run "label" "command": execute command with a spinner. On success,
# prints ✔ label. On failure, prints ✖ label and a confined "failure card"
# showing only the last N lines of captured output (full log retained on
# disk). Returns the command's exit code; does NOT exit the parent script;
# callers decide whether the failure is fatal.
ui::run() {
  local msg="$1"
  local cmd="$2"
  local logfile
  logfile="$(mktemp -t mechanica-run.XXXXXX)"

  ui::_spinner_start "$msg"
  local exit_code=0
  bash -c "$cmd" >"$logfile" 2>&1 || exit_code=$?
  ui::_spinner_stop

  if [ "$exit_code" -eq 0 ]; then
    ui::ok "$msg"
    rm -f "$logfile"
    return 0
  fi

  ui::fail "$msg (exit $exit_code)"
  ui::hint "command: $cmd"
  ui::_failure_card "$logfile" 15
  return "$exit_code"
}

# ui::_failure_card "logfile" [tail_n]: render a bordered card under a failed
# step showing the last N lines of captured output, with a reference to the
# full log. Confines multi-hundred-line stack traces to a bounded region so a
# failure reads as one tidy block, not a screen-dump.
ui::_failure_card() {
  local logfile="$1"
  local tail_n="${2:-15}"
  local line_count
  line_count="$(wc -l <"$logfile" 2>/dev/null | tr -d ' ')"
  [ -z "$line_count" ] && line_count="0"

  local hdr cnr_tl cnr_bl vert
  if ui::_supports_unicode; then
    hdr="─"; cnr_tl="┌"; cnr_bl="└"; vert="│"
  else
    hdr="-"; cnr_tl="+"; cnr_bl="+"; vert="|"
  fi

  local note
  if [ "$line_count" -gt "$tail_n" ]; then
    note="last ${tail_n} of ${line_count} lines · ${logfile}"
  else
    note="${line_count} lines · ${logfile}"
  fi

  printf "\n      %s%s%s%s output%s %s(%s)%s\n" \
    "${UI_DIM}" "$cnr_tl" "$hdr" "$hdr" "${UI_RESET}" \
    "${UI_DIM}" "$note" "${UI_RESET}" >&2

  tail -n "$tail_n" "$logfile" 2>/dev/null | while IFS= read -r line; do
    line="$(ui::_truncate "$line" 78)"
    printf "      %s%s%s  %s\n" "${UI_DIM}" "$vert" "${UI_RESET}" "$line" >&2
  done

  printf "      %s%s%s%s%s\n\n" \
    "${UI_DIM}" "$cnr_bl" "$hdr" "$hdr" "${UI_RESET}" >&2
}

# --- Summary dashboard -------------------------------------------------------

# ui::summary_begin "Title": opens a summary table.
ui::summary_begin() {
  printf "\n  %s%s%s\n" "${UI_BOLD}${UI_DIM}" "$1" "${UI_RESET}"
  printf "  %s%s%s\n" \
    "${UI_DIM}" "──────────────────────────────────────────────" "${UI_RESET}"
}

# ui::summary_row "label" "value" "status"
#   status: ok | warn | fail | skip | info | (empty for no icon)
ui::summary_row() {
  local label="$1"
  local value="$2"
  local status="${3:-}"
  local icon="  "
  local color="${UI_DIM}"

  case "$status" in
    ok)   icon="${UI_ICON_OK}";   color="${UI_SUCCESS}" ;;
    warn) icon="${UI_ICON_WARN}"; color="${UI_WARN}" ;;
    fail) icon="${UI_ICON_FAIL}"; color="${UI_ERROR}" ;;
    skip) icon="${UI_ICON_SKIP}"; color="${UI_DIM}" ;;
    info) icon="${UI_ICON_INFO}"; color="${UI_PRIMARY}" ;;
  esac

  printf "  %s%s%s %-26s %s%s%s\n" \
    "$color" "$icon" "${UI_RESET}" \
    "$label" \
    "${UI_DIM}" "$value" "${UI_RESET}"
}

# ui::summary_end: closes the summary table.
ui::summary_end() {
  printf "  %s%s%s\n\n" \
    "${UI_DIM}" "──────────────────────────────────────────────" "${UI_RESET}"
}
