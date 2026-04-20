#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  for env_key in \
    POSTGRES_PRISMA_DATABASE_URL \
    POSTGRES_PRISMA_URL \
    POSTGRES_DATABASE_URL \
    POSTGRES_URL \
    POSTGRES_URL_NON_POOLING
  do
    env_value="${!env_key:-}"
    if [[ -n "${env_value// }" ]]; then
      export DATABASE_URL="$env_value"
      echo "Using ${env_key} as DATABASE_URL for deploy schema sync."
      break
    fi
  done
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Skipping deploy schema sync because no database connection string is configured."
  exit 0
fi

case "$DATABASE_URL" in
  *://127.0.0.1*|*://localhost*|*://0.0.0.0*)
    echo "Refusing deploy schema sync because DATABASE_URL points to a local database."
    exit 1
    ;;
esac

pnpm --filter @bgc-alpha/db prisma:push
