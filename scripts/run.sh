#!/usr/bin/env bash
# scripts/run.sh: start/stop the Mechanica dev server (Vite + Cloudflare
# worker via vinext).
#
# Wired to `make start` / `make stop` / `make logs` / `make clean`.
#
# Flags:
#   (none)     Start the dev server in the background, poll readiness, print
#              the URL. Restarts cleanly if an instance is already running.
#   --stop     Tear down the dev server (and its process tree).
#   --logs     Tail the dev server log.
#   --clean    Stop the server, then remove build artefacts and run state
#              (dist, .wrangler, .run-state). node_modules is kept.
#   -h, --help Usage.

set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib/ui.sh
ui::init

STATE_DIR=".run-state"
PID_FILE="$STATE_DIR/dev.pid"
LOG_FILE="$STATE_DIR/dev.log"
URL_FILE="$STATE_DIR/dev.url"
READY_TIMEOUT="${MECHANICA_READY_TIMEOUT:-90}"
BASE_PORT="${MECHANICA_PORT:-5173}"

usage() {
  ui::banner "scripts/run.sh" "Dev server orchestration"
  ui::section "Usage"
  ui::cmd "./scripts/run.sh" "Start the dev server (background, health-gated)"
  ui::cmd "./scripts/run.sh --stop" "Stop the dev server"
  ui::cmd "./scripts/run.sh --logs" "Tail the dev server log"
  ui::cmd "./scripts/run.sh --clean" "Stop + remove dist, .wrangler, .run-state"
  echo ""
}

# kill_tree <pid>: kill a process and all of its descendants, children first.
# npm spawns vite, which spawns workerd; killing only the root leaks orphans.
kill_tree() {
  local pid="$1"
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill "$pid" >/dev/null 2>&1 || true
}

# find_free_port: first port from BASE_PORT upward with no listener on ANY
# interface. Vite only auto-increments when its own bind fails, but our config
# binds 0.0.0.0, which coexists with another server bound to 127.0.0.1 on the
# same port; both "start", and localhost traffic goes to the other server.
# So we pick the port ourselves and hold vite to it with --strictPort.
find_free_port() {
  local port="$BASE_PORT"
  local limit=$((BASE_PORT + 100))
  while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do
    port=$((port + 1))
    if [ "$port" -gt "$limit" ]; then
      return 1
    fi
  done
  printf "%s" "$port"
}

# stop_server: returns 0 if a running server was stopped, 1 if none was.
stop_server() {
  local pid
  if [ ! -f "$PID_FILE" ]; then
    return 1
  fi
  pid="$(cat "$PID_FILE")"
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    rm -f "$PID_FILE" "$URL_FILE"
    return 1
  fi
  kill_tree "$pid"
  local waited=0
  while kill -0 "$pid" >/dev/null 2>&1 && [ "$waited" -lt 10 ]; do
    sleep 1
    waited=$((waited + 1))
  done
  if kill -0 "$pid" >/dev/null 2>&1; then
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi
  rm -f "$PID_FILE" "$URL_FILE"
  return 0
}

do_stop() {
  ui::banner "make stop" "Stopping the Mechanica dev server"
  ui::step 1 1 "Teardown"
  if stop_server; then
    ui::ok "dev server stopped"
  else
    ui::skip "no dev server running"
  fi
  echo ""
}

do_logs() {
  if [ ! -f "$LOG_FILE" ]; then
    ui::die "no dev server log at $LOG_FILE" "start the server first: make start"
  fi
  ui::info "tailing $LOG_FILE (Ctrl-C to detach; the server keeps running)"
  exec tail -f "$LOG_FILE"
}

do_clean() {
  ui::banner "make clean" "Removing build artefacts and run state"
  ui::step 1 2 "Stop running services"
  if stop_server; then
    ui::ok "dev server stopped"
  else
    ui::skip "no dev server running"
  fi
  ui::step 2 2 "Remove artefacts"
  rm -rf dist .wrangler "$STATE_DIR"
  ui::ok "removed dist, .wrangler, $STATE_DIR"
  ui::hint "node_modules kept; remove manually if you want a from-scratch setup"
  echo ""
}

do_start() {
  ui::banner "make start" "Starting the Mechanica dev server"
  local total=3

  # ── 1/3 Preflight ──────────────────────────────────────────────────────────
  ui::step 1 "$total" "Preflight"
  if [ ! -d node_modules ]; then
    ui::die "node_modules is missing" "run: make setup (or make run for setup + start)"
  fi
  ui::ok "dependencies present"

  # ── 2/3 Launch ─────────────────────────────────────────────────────────────
  ui::step 2 "$total" "Launch dev server"
  if stop_server; then
    ui::info "stopped a stale dev server instance"
  fi
  local port
  if ! port="$(find_free_port)"; then
    ui::die "no free port in ${BASE_PORT}-$((BASE_PORT + 100))" \
      "free some ports or set MECHANICA_PORT"
  fi
  if [ "$port" -ne "$BASE_PORT" ]; then
    ui::info "port $BASE_PORT is taken, switched to $port automatically"
  fi
  mkdir -p "$STATE_DIR"
  : >"$LOG_FILE"
  nohup npm run dev:local -- --port "$port" --strictPort >>"$LOG_FILE" 2>&1 &
  local pid=$!
  disown 2>/dev/null || true
  printf "%s" "$pid" >"$PID_FILE"
  ui::ok "vite started"
  ui::detail "pid $pid · port $port · log $LOG_FILE"

  # ── 3/3 Readiness ──────────────────────────────────────────────────────────
  ui::step 3 "$total" "Wait for readiness"
  local url="http://localhost:$port/"
  local waited=0
  ui::_spinner_start "waiting for $url (timeout ${READY_TIMEOUT}s)"
  while [ "$waited" -lt "$READY_TIMEOUT" ]; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      ui::_spinner_stop
      ui::fail "dev server exited during startup"
      ui::_failure_card "$LOG_FILE" 15
      rm -f "$PID_FILE"
      exit 1
    fi
    if curl -sf -o /dev/null --max-time 2 "$url"; then
      break
    fi
    sleep 1
    waited=$((waited + 1))
  done
  ui::_spinner_stop

  if ! curl -sf -o /dev/null --max-time 2 "$url"; then
    ui::fail "dev server did not become ready within ${READY_TIMEOUT}s"
    ui::_failure_card "$LOG_FILE" 15
    ui::hint "it may still be compiling; check: make logs"
    exit 1
  fi

  printf "%s" "$url" >"$URL_FILE"
  ui::ok "dev server is serving"
  ui::detail "$url (ready in ${waited}s)"

  # ── Summary ────────────────────────────────────────────────────────────────
  ui::summary_begin "Dev Server"
  ui::summary_row "url" "$url" "ok"
  ui::summary_row "pid" "$pid" "info"
  ui::summary_row "log" "$LOG_FILE" "info"
  ui::summary_end
  ui::info "open $url in a WebGL2-capable browser"
  ui::hint "make logs to follow output · make stop to tear down"
  echo ""
}

case "${1:-}" in
  "") do_start ;;
  --stop) do_stop ;;
  --logs) do_logs ;;
  --clean) do_clean ;;
  -h|--help) usage ;;
  *) ui::die "unknown flag: $1" "see: ./scripts/run.sh --help" ;;
esac
