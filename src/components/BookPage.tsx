/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, Route, Smartphone } from 'lucide-react';
import BookingForm from './BookingForm.js';
import { useRouter } from '../router.js';
import { DEFAULT_PRICING, formatAmount } from '../pricing.js';

export default function BookPage() {
  // A region arriving from the map on the home page, so the customer does not
  // have to choose it twice.
  const { search } = useRouter();
  const initialRegion = new URLSearchParams(search).get('region') ?? '';
  // The published rate, so the bar reads correctly without waiting on the API.
  const rule = DEFAULT_PRICING;

  const { navigate } = useRouter();

  return (
    <div className="relative">
      {/* A slim bar, not a hero.
          The stepped form carries its own large heading ("Where do we
          collect?") immediately below, so a centred marketing headline here
          just said the same thing twice and pushed the first field off the
          screen. What is left is the one fact worth repeating at the moment
          somebody starts: the rate. */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-medium uppercase tracking-widest text-red-600">
              Book a delivery
            </span>
            <span className="text-sm text-slate-500">Takes about two minutes</span>
          </div>
          <p className="text-[15px] text-slate-600">
            <strong className="font-medium text-slate-900">{formatAmount(rule.baseAmount, rule.currency)}</strong>
            {' '}up to {rule.includedKg}kg · {formatAmount(rule.perExtraKgAmount, rule.currency)} per extra kilo
          </p>
        </div>
      </section>

      {/* The booking form */}
      {/* No navigation on success. A booking can now hold several parcels
          going to different regions, so jumping to one parcel's tracking page
          would hide the rest — the form shows its own confirmation with the
          booking reference and every code. */}
      <BookingForm initialRegion={initialRegion} onSuccessBooking={() => {}} />
    </div>
  );
}
