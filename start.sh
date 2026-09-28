#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$ROOT/backend/node_modules" ]; then
  npm install --prefix "$ROOT/backend"
fi
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  npm install --prefix "$ROOT/frontend"
fi

if [ ! -f "$ROOT/backend/prisma/dev.db" ]; then
  npm run db:generate --prefix "$ROOT/backend"
  npm run db:push --prefix "$ROOT/backend"
  npm run db:seed --prefix "$ROOT/backend"
fi

npm run dev --prefix "$ROOT/backend" &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

npm run dev --prefix "$ROOT/frontend"
