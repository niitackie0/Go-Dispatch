/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PackageSize = 'small' | 'medium' | 'large';

/**
 * The life of a parcel. Mirrors the enum in prisma/schema.prisma.
 *
 * Our job ends at the bus. A rider collects from the sender and brings the
 * parcel to the office; it is weighed and paid for there; a rider runs it to
 * the station and hands it to an intercity bus; both ends are texted the car
 * number. What happens at the far end is the recipient's business, not ours,
 * so `dispatched` is terminal and there is no `delivered`.
 */
export type OrderStatus =
  | 'requested'
  | 'confirmed'
  | 'queued'
  | 'picked_up'
  | 'at_office'
  | 'paid'
  | 'to_station'
  | 'dispatched'
  | 'cancelled'
  // Retired, and kept only so history rows written under the old model still
  // type. Nothing sets these.
  | 'awaiting_payment'
  | 'in_transit'
  | 'delivered';

/** The statuses still reachable. Retired ones are excluded deliberately. */
export const LIVE_ORDER_STATUSES: OrderStatus[] = [
  'requested',
  'confirmed',
  'queued',
  'picked_up',
  'at_office',
  'paid',
  'to_station',
  'dispatched',
  'cancelled',
];

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type PaymentProvider = 'manual' | 'momo';

/** Who settles the bill for a delivery. */
export type Payer = 'sender' | 'recipient';

/**
 * When the bill is settled: up front (gates confirmation), or after the parcel
 * has been weighed at the office (gates the bus). `on_delivery` is the older
 * of the two names and no longer describes a delivery -- nothing is handed
 * over at a door; it means "not prepaid", and the money is asked for once the
 * scale has set the real price.
 */
export type PaymentTiming = 'prepaid' | 'on_delivery';

/**
 * A courier on the roster.
 *
 * Not a console account. Riders never sign in -- they work from a per-order
 * link, so there is no email, password or role here. See AdminUser for the
 * people who do sign in; the two are deliberately separate registers.
 */
export interface Rider {
  id: string;
  name: string;
  phone: string;
  /** On the roster. Set by an owner; an inactive rider is never assigned work. */
  active: boolean;
  /** False while the rider is carrying an active job. Owned by the automation. */
  available: boolean;
  createdAt: string;
}

/**
 * Who is carrying this parcel right now, and on which leg.
 *
 * A parcel has two rider columns and only one of them is ever in play: the
 * collection until it reaches the office, the station run after it is paid for.
 * Every screen that wants to print "who has it" wants this, and picking the
 * column by hand at each call site is how one of them ends up showing the
 * collection rider on a parcel that is halfway to the bus station.
 */
export function riderLegOf(order: {
  status: OrderStatus;
  collectionRiderId?: string;
  collectionRiderName?: string;
  stationRiderId?: string;
  stationRiderName?: string;
}): { leg: 'collection' | 'station'; id?: string; name?: string } {
  const station = order.status === 'paid' || order.status === 'to_station' || order.status === 'dispatched';
  return station
    ? { leg: 'station', id: order.stationRiderId, name: order.stationRiderName }
    : { leg: 'collection', id: order.collectionRiderId, name: order.collectionRiderName };
}

/** A rider plus what the fleet page needs to say about them right now. */
export interface FleetRider extends Rider {
  /** Parcels this rider is carrying: queued, picked up or in transit. */
  carrying: number;
  /** Parcels they have delivered, ever. Deleting a rider would lose this. */
  delivered: number;
}

/** The job payload a courier sees behind their self-service link. */
export interface RiderJob {
  trackingCode: string;
  status: OrderStatus;
  /** The rider holding this leg — whichever leg the parcel is currently on. */
  riderName?: string;
  senderName: string;
  senderPhone: string;
  pickupAddress: string;
  pickupNotes?: string;
  recipientName: string;
  recipientPhone: string;
  dropoffAddress: string;
  dropoffNotes?: string;
  /** Region this parcel is going to. */
  destinationRegion?: string;
  /** The booking this parcel was part of, when it was sent with others. */
  bookingId?: string;
  /** What the office scale said. Absent until the parcel has been weighed. */
  actualWeightKg?: number;
  /** Set when weighing fixed the price. Until then priceAmount is an estimate. */
  priceConfirmedAt?: string;
  packageSize: PackageSize;
  packageWeightKg: number;
  packageDescription: string;
  scheduledPickupAt: string;
  priceAmount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  /** True when the bill is settled after weighing rather than up front. */
  cashToCollect: boolean;
  payer?: Payer;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  trackingCode: string;
  senderName: string;
  senderPhone: string;
  pickupAddress: string;
  pickupNotes?: string;
  recipientName: string;
  recipientPhone: string;
  dropoffAddress: string;
  dropoffNotes?: string;
  /** Region this parcel is going to. */
  destinationRegion?: string;
  /** The booking this parcel was part of, when it was sent with others. */
  bookingId?: string;
  /** What the office scale said. Absent until the parcel has been weighed. */
  actualWeightKg?: number;
  /** Set when weighing fixed the price. Until then priceAmount is an estimate. */
  priceConfirmedAt?: string;
  packageSize: PackageSize;
  packageWeightKg: number;
  packageDescription: string;
  scheduledPickupAt: string;
  priceAmount: number; // stored as integer in cents/pesewas (e.g. 5000 = 50.00 GHS)
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  /** Who pays — the sender who booked, or the recipient at the other end. */
  payer?: Payer;
  /** Retired: payment is always MoMo, after weighing. Read-only on old rows. */
  paymentTiming?: PaymentTiming;

  /** Sender -> office. Freed once the parcel is on the office scale. */
  collectionRiderId?: string;
  collectionRiderName?: string;
  /** Office -> station. Null when a staff member walks it round. */
  stationRiderId?: string;
  stationRiderName?: string;
  /** The bus it went on. Set when the parcel is dispatched, and never after. */
  busCarNumber?: string;

  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  providerReference?: string;
  status: 'pending' | 'success' | 'failed';
  paidAt?: string;
  recordedByAdminId?: string;
  note?: string;
  createdAt: string;
}

export interface StatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  note?: string;
  changedByAdminId?: string;
  changedByName?: string;
  changedAt: string;
}

/** The weight-based rate. See src/pricing.ts for how a quote is computed. */
export interface PricingConfig {
  /** Flat rate covering a parcel up to includedKg, in pesewas. */
  baseAmount: number;
  includedKg: number;
  /** Per whole kilo above the allowance, in pesewas. */
  perExtraKgAmount: number;
  currency: string;
}

/**
 * Staff roles. Capabilities are mapped in src/server/permissions.ts, which is
 * the single place the rules live — the UI only uses these to hide controls.
 */
export type AdminRole = 'owner' | 'finance' | 'support';

export const ADMIN_ROLES: AdminRole[] = ['owner', 'finance', 'support'];

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  createdAt: string;
}

export interface DashboardStats {
  /** Omitted for roles without `revenue:read` — support sees no turnover. */
  revenue?: {
    today: number;
    week: number;
    month: number;
    allTime: number;
  };
  counts: Record<OrderStatus, number>;
}
