-- CreateEnum
CREATE TYPE "SiteRequestStatus" AS ENUM ('new', 'contacted', 'admin_notified', 'closed');

-- AlterEnum
ALTER TYPE "NotificationEntityType" ADD VALUE 'site_request';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_system_support" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "site_requests" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "modules" TEXT[],
    "message" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "SiteRequestStatus" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "admin_notified_at" TIMESTAMP(3),
    "admin_notified_by_id" INTEGER,

    CONSTRAINT "site_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_requests_status_created_at_idx" ON "site_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "site_requests" ADD CONSTRAINT "site_requests_admin_notified_by_id_fkey" FOREIGN KEY ("admin_notified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
