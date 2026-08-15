/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Order as OrderRow,
  Payment as PaymentRow,
  Rider as RiderRow,
  StatusHistory as StatusHistoryRow,
} from '@prisma/client';
import type { Order, Payment, Rider, StatusHistory } from '../types.js';

/**
 * Converts Prisma rows into the API shapes the frontend already consumes.
 *
 * Two conversions matter and are easy to miss:
 *
 * - `packageWeightKg` is a Decimal. Left alone it serialises to a *string*,
 *   which quietly breaks any arithmetic on the client.
 * - Orders have no `riderName` column. The name comes from the joined rider,
 *   so the API shape is preserved without duplicating the column and having
 *   the copy drift when a rider is renamed.
 */

export type OrderWithRider = OrderRow & { rider?: RiderRow | null };

export function serializeOrder(row: OrderWithRider): Order {
  return {
    id: row.id,
    trackingCode: row.trackingCode,
    senderName: row.senderName,
    senderPhone: row.senderPhone,
    pickupAddress: row.pickupAddress,
    pickupNotes: row.pickupNotes ?? undefined,
    recipientName: row.recipientName,
    recipientPhone: row.recipientPhone,
    dropoffAddress: row.dropoffAddress,
    dropoffNotes: row.dropoffNotes ?? undefined,
    packageSize: row.packageSize,
    packageWeightKg: row.packageWeightKg.toNumber(),
    packageDescription: row.packageDescription,
    scheduledPickupAt: row.scheduledPickupAt.toISOString(),
    priceAmount: row.priceAmount,
    currency: row.currency,
    status: row.status,
    paymentStatus: row.paymentStatus,
    payer: row.payer,
    paymentTiming: row.paymentTiming,
    riderId: row.riderId ?? undefined,
    riderName: row.rider?.name ?? undefined,
    riderToken: row.riderToken ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializePayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    orderId: row.orderId,
    amount: row.amount,
    currency: row.currency,
    provider: row.provider,
    providerReference: row.providerReference ?? undefined,
    status: row.status,
    paidAt: row.paidAt?.toISOString(),
    recordedByAdminId: row.recordedByAdminId ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeHistory(row: StatusHistoryRow): StatusHistory {
  return {
    id: row.id,
    orderId: row.orderId,
    status: row.status,
    note: row.note ?? undefined,
    changedByAdminId: row.changedByAdminId ?? undefined,
    changedByName: row.changedByName ?? undefined,
    changedAt: row.changedAt.toISOString(),
  };
}

export function serializeRider(row: RiderRow): Rider {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    available: row.available,
    createdAt: row.createdAt.toISOString(),
  };
}
