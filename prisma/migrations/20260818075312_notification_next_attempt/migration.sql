-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "nextAttemptAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "notifications_status_nextAttemptAt_idx" ON "notifications"("status", "nextAttemptAt");
