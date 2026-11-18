#!/usr/bin/env bash
set -euo pipefail

# U-GOV V10 — Zero-Cost Local Cloud Environment Controller (Linux / macOS)
# Manages strictly local Docker PostgreSQL 16 and Firebase Emulator Suite.
# Never provisions live cloud resources or enables Firebase Blaze billing.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

ACTION="${1:-status}"

require_cmd() {
  local cmd="$1"
  local hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] Missing '$cmd'. $hint" >&2
    exit 1
  fi
}

case "$ACTION" in
  status)
    echo "=== U-GOV Local Cloud Prerequisites ==="
    for cmd in node npm docker firebase java psql; do
      if command -v "$cmd" >/dev/null 2>&1; then
        echo "  [OK] $cmd -> $(command -v "$cmd")"
      else
        echo "  [MISSING] $cmd"
      fi
    done
    if command -v docker >/dev/null 2>&1; then
      echo ""
      echo "=== Docker Compose Containers ==="
      docker compose --profile app ps
    fi
    ;;
  start)
    require_cmd docker "Install Docker Engine / Docker Desktop."
    echo "Starting local PostgreSQL 16 container (127.0.0.1:5432)..."
    docker compose up -d postgres
    docker compose ps
    ;;
  start-all)
    require_cmd docker "Install Docker Engine / Docker Desktop."
    echo "Starting local PostgreSQL 16 + U-GOV containerized app profile..."
    docker compose --profile app up -d
    docker compose --profile app ps
    ;;
  stop)
    require_cmd docker "Install Docker Engine / Docker Desktop."
    echo "Stopping local U-GOV containers (volumes preserved)..."
    docker compose --profile app down
    ;;
  reset)
    require_cmd docker "Install Docker Engine / Docker Desktop."
    echo "Stopping containers and removing local Docker volumes..."
    docker compose --profile app down -v
    ;;
  logs)
    require_cmd docker "Install Docker Engine / Docker Desktop."
    docker compose --profile app logs --tail=100 -f
    ;;
  psql-check)
    require_cmd docker "Install Docker Engine / Docker Desktop."
    DB_USER="${POSTGRES_USER:-ugov_dev}"
    DB_NAME="${POSTGRES_DB:-ugov}"
    docker compose exec postgres pg_isready -U "$DB_USER" -d "$DB_NAME"
    docker compose exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c '\dt'
    ;;
  emulators)
    require_cmd firebase "Install Firebase CLI: npm install -g firebase-tools"
    require_cmd java "Install Java 21+ JDK (required by Firestore & Storage emulators)."
    echo "Starting Firebase Emulator Suite (Auth:9099, Firestore:8080, Storage:9199, UI:4000) for project demo-ugov-local..."
    firebase emulators:start --project demo-ugov-local
    ;;
  emulators-auth)
    require_cmd firebase "Install Firebase CLI: npm install -g firebase-tools"
    echo "Starting Firebase Auth Emulator only (127.0.0.1:9099) for project demo-ugov-local..."
    firebase emulators:start --only auth --project demo-ugov-local
    ;;
  *)
    echo "Usage: $0 {status|start|start-all|stop|reset|logs|psql-check|emulators|emulators-auth}" >&2
    exit 2
    ;;
esac
