#!/bin/sh

# Dev entrypoint: prepare the database, then start Next.js with hot reload.
# (The production entrypoint is docker-entrypoint.sh, which runs `pnpm start`.)

# With Mailpit on (COMPOSE_PROFILES=mailpit in .env), all mail goes to its inbox,
# whatever the SMTP_* settings in .env say.
case ",$COMPOSE_PROFILES," in
  *,mailpit,*)
    echo "[dev] Mailpit is on: mail goes to http://localhost:8025"
    export SMTP_HOST=mailpit SMTP_PORT=1025 SMTP_SECURE=false SMTP_REQUIRE_TLS=false
    export SMTP_USER= SMTP_PASSWORD= SMTP_AUTH=
    export MAIL_FROM="${MAIL_FROM:-Support Portal <no-reply@support.local>}"
    ;;
esac

echo "[dev] Generating Prisma client..."
npx prisma generate

echo "[dev] Waiting for database and syncing schema..."
# One-off data upgrades that `db push` can't do on its own (it would drop the
# replaced columns and lose their data), in order. Idempotent: each does nothing
# on a fresh or already-upgraded database. Retries while the database is still
# starting.
for upgrade in \
  prisma/migrations/20261103000000_user_role_enum/migration.sql \
  prisma/migrations/20261103010000_user_scopes/migration.sql \
  prisma/migrations/20261103020000_contact_requests/migration.sql \
  prisma/migrations/20261103030000_ecm_plus_name/migration.sql \
  prisma/migrations/20261103040000_scope_logo/migration.sql; do
  until npx prisma db execute --file "$upgrade"; do
    echo "[dev] Database not ready yet, retrying in 3 seconds..."
    sleep 3
  done
done

# Use --url to pass DATABASE_URL directly, bypassing prisma.config.ts (which
# needs tsx/dotenv and may not resolve here).
until npx prisma db push --url "$DATABASE_URL"; do
  echo "[dev] Database not ready yet, retrying in 3 seconds..."
  sleep 3
done

echo "[dev] Seeding database (idempotent)..."
npx prisma db seed || echo "[dev] Seed skipped/failed (continuing)."

echo "[dev] Starting Next.js dev server with hot reload..."
# Use webpack, not Turbopack: Turbopack's Rust filesystem layer fails to resolve
# bracket-named dynamic route segments ([id], etc.) over the Windows Docker bind
# mount, 404-ing every dynamic route. Webpack uses Node's fs and resolves them.
exec pnpm exec next dev --webpack
