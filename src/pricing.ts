/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * What a delivery costs.
 *
 * One flat rate covers a normal parcel to any town — "one rate, many places" —
 * and weight above the included allowance is charged per kilo.
 *
 * Shared deliberately: the server computes the authoritative price with this,
 * and the booking form quotes with the same function, so the figure a customer
 * agrees to is the figure they are charged. The customer's browser never sends
 * a price; it sends a weight, and the server prices it.
 *
 * All amounts are integer pesewas (5000 = GHS 50.00). Money is never a float.
 *
 * This file must stay free of server-only imports so it can be bundled.
 */

export interface PricingRule {
  /** Covers everything up to and including `includedKg`. */
  baseAmount: number;
  includedKg: number;
  /** Charged per whole kilo above the allowance. */
  perExtraKgAmount: number;
  currency: string;
}

export const DEFAULT_PRICING: PricingRule = {
  baseAmount: 5000, // GHS 50.00
  includedKg: 3,
  perExtraKgAmount: 1000, // GHS 10.00
  currency: 'GHS',
};

export interface Quote {
  total: number;
  baseAmount: number;
  /** Whole kilos billed above the allowance; 0 when within it. */
  extraKg: number;
  extraAmount: number;
  currency: string;
}

/**
 * Price a parcel.
 *
 * Part kilos round UP: 3.1kg is billed as 4kg. That is the standard courier
 * convention and it is the only rule that is simple to explain at a counter.
 *
 * A missing or nonsensical weight is treated as the minimum billable parcel
 * rather than as free — an unpriced delivery is worse than a cheap one.
 */
export function quote(weightKg: number, rule: PricingRule = DEFAULT_PRICING): Quote {
  const weight = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 0;

  // Round up, but guard the floating-point edge: 3.0000000000000004 from a
  // decimal input must not bill as 4kg.
  const billableKg = Math.max(0, Math.ceil(Number((weight - rule.includedKg).toFixed(6))));

  const extraAmount = billableKg * rule.perExtraKgAmount;

  return {
    total: rule.baseAmount + extraAmount,
    baseAmount: rule.baseAmount,
    extraKg: billableKg,
    extraAmount,
    currency: rule.currency,
  };
}

/** "GHS 60.00" */
export function formatAmount(pesewas: number, currency = 'GHS'): string {
  return `${currency} ${(pesewas / 100).toFixed(2)}`;
}

/**
 * The size label shown to riders and on the dispatch board.
 *
 * Derived from weight rather than asked for: since price no longer depends on
 * size, making a customer choose one would be a question with no consequence.
 * Riders still need to know whether a job fits on a motorbike.
 */
export function sizeForWeight(weightKg: number): 'small' | 'medium' | 'large' {
  if (weightKg <= 3) return 'small';
  if (weightKg <= 10) return 'medium';
  return 'large';
}
