-- Index the two columns public tracking searches.
--
-- GET /api/orders/track matches senderPhone and recipientPhone exactly, and
-- neither was indexed. At three orders that is free. At thirty thousand it is a
-- sequential scan of the whole table, on the one endpoint that is unauthenticated
-- and therefore the one anybody can ask for repeatedly.
--
-- CONCURRENTLY is deliberately NOT used: it cannot run inside the transaction
-- Prisma wraps migrations in, and this table is small enough that the brief lock
-- costs nothing. Revisit if this ever runs against a large live table.

CREATE INDEX "orders_senderPhone_idx" ON "orders"("senderPhone");
CREATE INDEX "orders_recipientPhone_idx" ON "orders"("recipientPhone");
