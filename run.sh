#!/usr/bin/env bash
#
# chati launcher
#
#   ./run.sh          # dev:  backend :8000  +  vite dev :5173
#   ./run.sh --prod   # prod: build frontend, serve everything from backend :8000
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
PROD=0
[[ "${1:-}" == "--prod" ]] && PROD=1

# ---------------------------------------------------------------- database
DB_URL="${DATABASE_URL:-postgresql+asyncpg://chati:chati@127.0.0.1:5432/chati}"
if command -v psql >/dev/null 2>&1; then
  if ! psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='chati'" 2>/dev/null | grep -q 1; then
    echo ">> creating Postgres role + database 'chati'"
    psql -d postgres -v ON_ERROR_STOP=0 >/dev/null <<'SQL' || true
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='chati') THEN
    CREATE ROLE chati LOGIN PASSWORD 'chati' CREATEDB;
  END IF;
END $$;
SQL
    psql -d postgres -c "CREATE DATABASE chati OWNER chati;" >/dev/null 2>&1 || true
  fi
fi

# ---------------------------------------------------------------- backend env
if [[ ! -f "$BACKEND/.env" ]]; then
  cp "$ROOT/.env.example" "$BACKEND/.env"
fi

# ---------------------------------------------------------------- backend venv
if [[ ! -x "$BACKEND/.venv/bin/python" ]]; then
  echo ">> creating backend venv + installing deps"
  if command -v uv >/dev/null 2>&1; then
    uv venv "$BACKEND/.venv"
    uv pip install --python "$BACKEND/.venv/bin/python" -r "$BACKEND/requirements.txt"
  else
    python3 -m venv "$BACKEND/.venv"
    "$BACKEND/.venv/bin/pip" install -r "$BACKEND/requirements.txt"
  fi
fi

# ---------------------------------------------------------------- frontend deps
if [[ ! -d "$FRONTEND/node_modules" ]]; then
  echo ">> installing frontend deps"
  ( cd "$FRONTEND" && npm install )
fi

# ---------------------------------------------------------------- build (prod)
if [[ "$PROD" == "1" ]]; then
  echo ">> building frontend"
  ( cd "$FRONTEND" && npm run build )
fi

# ---------------------------------------------------------------- launch
PIDS=()
cleanup() {
  echo; echo ">> shutting down"
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

echo ">> starting backend on http://127.0.0.1:8000"
( cd "$BACKEND" && exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 ) &
PIDS+=($!)

if [[ "$PROD" == "1" ]]; then
  echo ">> open http://127.0.0.1:8000"
else
  echo ">> starting frontend dev server on http://127.0.0.1:5173"
  ( cd "$FRONTEND" && exec npm run dev ) &
  PIDS+=($!)
  echo ">> open http://127.0.0.1:5173"
fi

wait
