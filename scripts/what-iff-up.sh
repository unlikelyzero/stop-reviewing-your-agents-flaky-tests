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
[ -f .env ] || cp .env.example .env
make db-up
LLM_BACKEND=mock make dev-up

cd web/app
[ -d node_modules ] || npm ci
echo "starting Angular dev server on :4200 (Ctrl-C stops it; API keeps running — 'make dev-down' in $WHATIFF_DIR stops that)"
npm start
