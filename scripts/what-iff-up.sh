#!/usr/bin/env bash
# Bring up what-iff in mock-LLM mode (no provider keys) next to this repo.
#
#   WHATIFF_DIR=../what-iff bash scripts/what-iff-up.sh
#
# Needs: Docker (Postgres), Go 1.27+, Node 22+. Leaves the API on :8080 and the
# Angular dev server on :4200 — the two URLs playwright.config.ts defaults to.
set -euo pipefail

WHATIFF_DIR="${WHATIFF_DIR:-$(cd "$(dirname "$0")/.." && pwd)/../what-iff}"
if [ ! -d "$WHATIFF_DIR" ]; then
  echo "cloning what-iff into $WHATIFF_DIR"
  git clone --depth 1 https://github.com/theimaginaryfoundation/what-iff "$WHATIFF_DIR"
fi

cd "$WHATIFF_DIR"
if [ ! -f .env ]; then
  cp .env.example .env
  # The API refuses to boot without these; .env.example ships them commented out.
  {
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
    echo "TOKEN_ENCRYPTION_SECRET=$(openssl rand -hex 32)"
    echo "AUTO_MIGRATE=true"
  } >> .env
fi
make db-up
[ -d ent/user ] || make generate   # Ent code is not committed upstream
LLM_BACKEND=mock make dev-up

cd web/app
[ -d node_modules ] || npm ci
echo "starting Angular dev server on :4200 (Ctrl-C stops it; API keeps running — 'make dev-down' in $WHATIFF_DIR stops that)"
npm start
