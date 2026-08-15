-- Session metadata, so the "signed in devices" list can show something a human
-- can actually recognise. Existing sessions get lastSeenAt = now() rather than
-- being invalidated; nobody should be signed out by a schema change.

ALTER TABLE "sessions"
  ADD COLUMN "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "ipAddress" TEXT;
