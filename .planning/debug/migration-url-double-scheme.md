---
status: awaiting_human_verify
trigger: "Gateway fails to run migrations - double-scheme URL"
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:00:00Z
---

## Current Focus

hypothesis: runMigrations prepends "pgx5://" to DB_URL which already has "postgres://" scheme, creating invalid double-scheme URL
test: Read config default and runMigrations code
expecting: Confirmed double-scheme construction
next_action: Apply fix - replace scheme instead of prepending

## Symptoms

expected: Gateway starts, migrations run successfully against the database
actual: Gateway connects to DB successfully but crashes with FATAL on migration step
errors: "creating migrator: failed to open database: failed to connect to `user=root database=postgres:prism@prism-db:5432/prism`: hostname resolving error: lookup postgres on 127.0.0.11:53: no such host"
reproduction: `docker compose up --build` after clean volumes
started: After Phase 1 restructuring added golang-migrate

## Eliminated

(none)

## Evidence

- timestamp: 2026-03-16T00:01:00Z
  checked: apps/gateway/main.go line 124
  found: `migrate.NewWithSourceInstance("iofs", source, "pgx5://"+dbURL)` prepends "pgx5://" unconditionally
  implication: When dbURL = "postgres://postgres:prism@...", result is "pgx5://postgres://..." which is invalid

- timestamp: 2026-03-16T00:01:30Z
  checked: apps/gateway/config/config.go line 28
  found: DB_URL default is "postgres://postgres:prism@localhost:5432/prism?sslmode=disable"
  implication: Confirms dbURL always has a scheme; prepending creates double-scheme

## Resolution

root_cause: runMigrations in main.go line 124 prepends "pgx5://" to DB_URL which already contains "postgres://" scheme, producing invalid URL "pgx5://postgres://..."
fix: Replace the existing scheme (postgres:// or postgresql://) with pgx5:// using strings.Replace
verification: (pending)
files_changed: [apps/gateway/main.go]
