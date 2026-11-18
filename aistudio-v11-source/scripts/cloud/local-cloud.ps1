<#
.SYNOPSIS
  U-GOV V10 — Zero-Cost Local Cloud Environment Controller (Windows PowerShell)
.DESCRIPTION
  Manages strictly local Docker PostgreSQL 16 and Firebase Emulator Suite (Auth, Firestore, Storage, UI).
  Never provisions live cloud resources or enables Firebase Blaze billing.
.EXAMPLE
  .\scripts\cloud\local-cloud.ps1 status
  .\scripts\cloud\local-cloud.ps1 start
  .\scripts\cloud\local-cloud.ps1 emulators
  .\scripts\cloud\local-cloud.ps1 psql-check
  .\scripts\cloud\local-cloud.ps1 stop
  .\scripts\cloud\local-cloud.ps1 reset
#>
param(
  [ValidateSet("status", "start", "start-all", "stop", "reset", "logs", "psql-check", "emulators", "emulators-auth")]
  [string]$Action = "status"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $RepoRoot

function Assert-Command($Name, $InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required tool '$Name' was not found in PATH. $InstallHint"
  }
}

switch ($Action) {
  "status" {
    Write-Host "=== U-GOV Local Cloud Prerequisites ===" -ForegroundColor Cyan
    foreach ($cmd in @("node", "npm", "docker", "firebase", "java")) {
      $found = Get-Command $cmd -ErrorAction SilentlyContinue
      if ($found) {
        Write-Host "  [OK] $cmd -> $($found.Source)" -ForegroundColor Green
      } else {
        Write-Host "  [MISSING] $cmd" -ForegroundColor Yellow
      }
    }
    if (Get-Command docker -ErrorAction SilentlyContinue) {
      Write-Host "`n=== Docker Compose Containers ===" -ForegroundColor Cyan
      docker compose --profile app ps
    }
  }
  "start" {
    Assert-Command "docker" "Install Docker Desktop for Windows: https://docs.docker.com/desktop/install/windows-install/"
    Write-Host "Starting local PostgreSQL 16 container (127.0.0.1:5432)..." -ForegroundColor Cyan
    docker compose up -d postgres
    docker compose ps
  }
  "start-all" {
    Assert-Command "docker" "Install Docker Desktop for Windows."
    Write-Host "Starting local PostgreSQL 16 + U-GOV containerized app profile..." -ForegroundColor Cyan
    docker compose --profile app up -d
    docker compose --profile app ps
  }
  "stop" {
    Assert-Command "docker" "Install Docker Desktop for Windows."
    Write-Host "Stopping local U-GOV containers (volumes preserved)..." -ForegroundColor Cyan
    docker compose --profile app down
  }
  "reset" {
    Assert-Command "docker" "Install Docker Desktop for Windows."
    Write-Host "Stopping containers and removing local Docker volumes (PostgreSQL & container storage)..." -ForegroundColor Yellow
    docker compose --profile app down -v
  }
  "logs" {
    Assert-Command "docker" "Install Docker Desktop for Windows."
    docker compose --profile app logs --tail=100 -f
  }
  "psql-check" {
    Assert-Command "docker" "Install Docker Desktop for Windows."
    $dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "ugov_dev" }
    $dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "ugov" }
    docker compose exec postgres pg_isready -U $dbUser -d $dbName
    docker compose exec postgres psql -U $dbUser -d $dbName -c "\dt"
  }
  "emulators" {
    Assert-Command "firebase" "Install Firebase CLI: npm install -g firebase-tools"
    Assert-Command "java" "Install Java 21+ JDK (required by Firestore & Storage emulators): https://adoptium.net/"
    Write-Host "Starting Firebase Emulator Suite (Auth:9099, Firestore:8080, Storage:9199, UI:4000) for project demo-ugov-local..." -ForegroundColor Cyan
    firebase emulators:start --project demo-ugov-local
  }
  "emulators-auth" {
    Assert-Command "firebase" "Install Firebase CLI: npm install -g firebase-tools"
    Write-Host "Starting Firebase Auth Emulator only (127.0.0.1:9099) for project demo-ugov-local (no Java required)..." -ForegroundColor Cyan
    firebase emulators:start --only auth --project demo-ugov-local
  }
}
