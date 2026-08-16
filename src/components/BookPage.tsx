/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, Route, Smartphone } from 'lucide-react';
import BookingForm from './BookingForm.js';
import { useRouter } from '../router.js';

export default function BookPage() {
  // A region arriving from the map on the home page, so the customer does not
  // have to choose it twice.
  const { search } = useRouter();
  const initialRegion = new URLSearchParams(search).get('region') ?? '';

  const { navigate } = useRouter();

  return (
    <div className="relative">
      {/* Slim page header */}
      <section className="relative overflow-hidden aurora-bg border-b border-slate-200/70">
        <div className="absolute inset-0 wp-grid opacity-70" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-14 pb-10 text-center">
          <span className="text-xs font-mono uppercase tracking-widest text-red-600 font-semibold">Book a delivery</span>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Schedule your parcel pickup
          </h1>
          <p className="mt-3 text-slate-600 max-w-xl mx-auto">
            Tell us where to collect, where it is going, and how much it weighs. One flat rate to every town we serve.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Route className="h-4 w-4 text-red-600" /> Real-time tracking</span>
            <span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-red-600" /> Instant MoMo prompt</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-red-600" /> Auditable payments</span>
          </div>
        </div>
      </section>

      {/* The booking form */}
      <BookingForm initialRegion={initialRegion} onSuccessBooking={(code) => navigate(`/track?code=${encodeURIComponent(code)}`)} />
    </div>
  );
}
