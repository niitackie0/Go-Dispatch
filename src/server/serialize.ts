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
 *
 * WHAT IS NOT HERE: riderToken, and now nothing serialises it at all.
 *
 * It used to be in this function, which feeds public responses -- so a booking
 * reference could be exchanged for the courier's token, and that token marks a
 * parcel delivered and its bill settled. It was moved behind an admin session
 * for the console's "copy the courier's link" button; that button has since
 * been removed, so the token has no reader left and does not leave the server
 * at all.
 *
 * The rider pages still work for anyone holding a link, but nothing now hands
 * one out. If couriers are meant to have them again, the answer is to text the
 * link to the rider rather than to put it back on a screen.
 */

/**
 * An order with whichever rider rows were joined.
 *
 * TWO LEGS, so two possible joins: the collection (sender -> office) and the
 * station run (office -> bus). Both are optional because most queries want
 * neither, and a parcel has only one of them for most of its life.
 */
export type OrderWithRider = OrderRow & {
  collectionRider?: RiderRow | null;
  stationRider?: RiderRow | null;
};

/**
 * The Prisma `include` that fills both legs.
 *
 * One constant rather than a literal at every call site: a query that forgets
 * one of them does not fail, it silently reports the parcel as unassigned.
 */
export const ORDER_RIDERS = { collectionRider: true, stationRider: true } as const;

/** The rider who holds the parcel right now, if anyone does. */
export function currentRider(row: OrderWithRider): RiderRow | null {
  if (row.status === 'to_station' || row.status === 'dispatched') {
    return row.stationRider ?? null;
  }
  return row.collectionRider ?? null;
}

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
    destinationRegion: row.destinationRegion ?? undefined,
    bookingId: row.bookingId ?? undefined,
    actualWeightKg: row.actualWeightKg ? row.actualWeightKg.toNumber() : undefined,
    priceConfirmedAt: row.priceConfirmedAt ? row.priceConfirmedAt.toISOString() : undefined,
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
    collectionRiderId: row.collectionRiderId ?? undefined,
    collectionRiderName: row.collectionRider?.name ?? undefined,
    stationRiderId: row.stationRiderId ?? undefined,
    stationRiderName: row.stationRider?.name ?? undefined,
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
    active: row.active,
    available: row.available,
    createdAt: row.createdAt.toISOString(),
  };
}
