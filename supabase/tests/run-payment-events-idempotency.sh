#!/usr/bin/env bash
# Runs the payment_events idempotency SQL tests against a THROWAWAY local
# Postgres cluster. Never point this at a Supabase project.
#
# Usage (from the repo root):
#   PG_BIN=/usr/lib/postgresql/16/bin bash supabase/tests/run-payment-events-idempotency.sh
set -euo pipefail

PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb || echo /usr/lib/postgresql/16/bin/initdb)")}"
WORK_DIR="$(mktemp -d)"
PORT="${PG_TEST_PORT:-54329}"
SOCKET_DIR="$WORK_DIR/socket"
mkdir -p "$SOCKET_DIR"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORK_DIR/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

if [ "$(id -u)" = "0" ]; then
  echo "Refusing to run initdb as root; run as an unprivileged user." >&2
  exit 1
fi

"$PG_BIN/initdb" -D "$WORK_DIR/data" -U postgres -A trust >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK_DIR/data" -o "-p $PORT -k $SOCKET_DIR -c listen_addresses=''" -w start >/dev/null

run_case() {
  local db="$1" file="$2"
  "$PG_BIN/createdb" -h "$SOCKET_DIR" -p "$PORT" -U postgres "$db"
  psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U postgres -d "$db" -f "$file" 2>&1 \
    | sed -n 's/.*NOTICE:  //p; s/.*ERROR:  /ERROR: /p'
}

run_case idempotency supabase/tests/payment_events_idempotency.sql
run_case duplicate_guard supabase/tests/payment_events_duplicate_guard.sql
