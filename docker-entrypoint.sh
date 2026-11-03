#!/bin/sh

echo "[Entrypoint] Checking database connection and pushing schema..."

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
    echo "[Entrypoint] Database not ready yet, retrying in 3 seconds..."
    sleep 3
  done
done

# Loop until prisma can successfully push to the database.
# Use --url to pass the DATABASE_URL directly, bypassing prisma.config.ts
# which requires tsx/dotenv and may not resolve in the production container.
until npx prisma db push --url "$DATABASE_URL"; do
  echo "[Entrypoint] Database not ready yet, retrying in 3 seconds..."
  sleep 3
done

echo "[Entrypoint] Database schema is up to date."

# Seed the database (idempotent)
echo "[Entrypoint] Seeding database..."
npx prisma db seed

echo "[Entrypoint] Starting Next.js application..."
exec pnpm start
