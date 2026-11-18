# U-GOV V10 — Zero-Cost Local Cloud Environment (Milestone M1)

This guide explains how to run the strictly local, ₹0 U-GOV development environment using Docker Compose (PostgreSQL 16) and the Firebase Emulator Suite (`demo-ugov-local`).

> **Important Cloud & Billing Guardrails**
> - **₹0 Expenditure**: All services below run on `127.0.0.1` on your workstation.
> - **Live Firebase Cloud Storage**: Requires the Blaze billing plan and remains **blocked** in M1. Use the local Storage Emulator (`127.0.0.1:9199`) exclusively.
> - **Pub/Sub Boundary**: Google Cloud Pub/Sub is **not** a built-in Firebase Emulator Suite service; local Pub/Sub emulator wiring is deferred to **Milestone M6**.
> - **Default JSON Fallback**: Existing `npm run dev` continues to work without Docker, Java, or any cloud credentials using `src/server/database/ugov_store.json` (or `UGOV_DATA_DIR`).

---

## 1. Local Service Ports

| Service | Host & Port | Purpose |
|---|---|---|
| U-GOV Express + Vite App | `http://127.0.0.1:3000` | Main web UI + Express API |
| PostgreSQL 16 (Docker) | `127.0.0.1:5432` | Local relational DB initialized with `schema.sql` + `001_v6_lifecycle_foundation.sql` |
| Firebase Emulator UI | `http://127.0.0.1:4000` | Local web console for Auth, Firestore, and Storage emulators |
| Firebase Auth Emulator | `127.0.0.1:9099` | Local Auth tokens (`demo-ugov-local`) |
| Cloud Firestore Emulator | `127.0.0.1:8080` | Local Firestore enforcing `firestore.rules` |
| Firebase Storage Emulator | `127.0.0.1:9199` | Local Cloud Storage enforcing `storage.rules` |

---

## 2. Prerequisites

1. **Node.js 22+ & npm**: Required for the U-GOV app and test runner.
2. **Docker Desktop (Windows/macOS) or Docker Engine + Compose v2 (Linux)**:
   - Required to run local `postgres:16-alpine` (and optional `ugov-app` container profile).
   - Verify: `docker --version` and `docker compose version`.
3. **Firebase CLI (`firebase-tools`)**:
   - Install globally if not present: `npm install -g firebase-tools`.
   - Verify: `firebase --version`.
   - No `firebase login` or billing plan is required when using `--project demo-ugov-local`.
4. **Java 21+ JDK (Eclipse Temurin / OpenJDK)**:
   - Required by Firebase CLI to run **Firestore Emulator**, **Storage Emulator**, and **Emulator UI**.
   - **Firebase Auth Emulator (`--only auth`) works with Node.js alone** without Java.

---

## 3. Windows PowerShell Commands

```powershell
# 1. Inspect installed tools & container status
.\scripts\cloud\local-cloud.ps1 status

# 2. Start local PostgreSQL 16 (auto-loads schema.sql + 001_v6_lifecycle_foundation.sql on first boot)
.\scripts\cloud\local-cloud.ps1 start
# Or via npm:
npm run cloud:up

# 3. Verify PostgreSQL tables & health
.\scripts\cloud\local-cloud.ps1 psql-check

# 4. Start Firebase Emulator Suite (Auth + Firestore + Storage + UI)
.\scripts\cloud\local-cloud.ps1 emulators
# Or Auth Emulator only (if Java is not installed):
.\scripts\cloud\local-cloud.ps1 emulators-auth

# 5. Start the U-GOV app natively in a second terminal (preserves hot-start dev workflow)
npm run dev

# Optional: Start containerized PostgreSQL + U-GOV app together
.\scripts\cloud\local-cloud.ps1 start-all

# 6. Stop containers (preserves local database volume)
.\scripts\cloud\local-cloud.ps1 stop
# Or reset all local Docker volumes completely:
.\scripts\cloud\local-cloud.ps1 reset
```

---

## 4. Linux / macOS Commands

```bash
chmod +x scripts/cloud/local-cloud.sh

# Inspect prerequisites & running services
./scripts/cloud/local-cloud.sh status

# Start PostgreSQL 16
./scripts/cloud/local-cloud.sh start
# Verify tables
./scripts/cloud/local-cloud.sh psql-check

# Start Firebase Emulator Suite (requires Java 21+ for Firestore/Storage/UI)
./scripts/cloud/local-cloud.sh emulators
# Or Auth Emulator only (no Java required)
./scripts/cloud/local-cloud.sh emulators-auth

# Start U-GOV Express + Vite server
npm run dev

# Stop / Reset containers
./scripts/cloud/local-cloud.sh stop
./scripts/cloud/local-cloud.sh reset
```
