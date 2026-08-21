-- Add the enum values the bus model needs. NOTHING USES THEM YET.
--
-- Split from the migration that follows on purpose. Postgres will not let a
-- new enum value be USED in the same transaction that added it, and Prisma
-- wraps each migration in one -- so adding a value and updating a row to it
-- together fails with "unsafe use of new value of enum type". Two migrations,
-- two transactions, and the second can rely on the first.
--
-- The retired values (awaiting_payment, in_transit, delivered on OrderStatus;
-- out_for_delivery, delivered, price_confirmed on NotificationEvent) are
-- deliberately NOT removed. status_history is append-only and notification
-- rows record what a customer was actually told; rewriting either to fit a
-- model invented afterwards would falsify the record rather than migrate it.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'at_office';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'to_station';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'dispatched';

ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'payment_request';
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'dispatched_sender';
ALTER TYPE "NotificationEvent" ADD VALUE IF NOT EXISTS 'dispatched_recipient';
