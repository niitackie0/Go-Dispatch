/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PackageSize = 'small' | 'medium' | 'large';

export type OrderStatus =
  | 'requested'
  | 'awaiting_payment'
  | 'confirmed'
  | 'queued'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type PaymentProvider = 'manual' | 'momo';

/** Who settles the bill for a delivery. */
export type Payer = 'sender' | 'recipient';

/** When the bill is settled: up front (gates confirmation) or at the door. */
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
  /** True when the courier must collect money at the door. */
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
  /** Prepaid orders cannot confirm until payment lands; on_delivery orders dispatch with "payment due". */
  paymentTiming?: PaymentTiming;
  /** Assigned courier, set when the order is auto-queued. */
  riderId?: string;
  riderName?: string;
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
