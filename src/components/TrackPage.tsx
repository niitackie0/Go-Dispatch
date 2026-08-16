/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import TrackingView from './TrackingView.js';
import { useRouter } from '../router.js';

export default function TrackPage() {
  const { search } = useRouter();
  const initialCode = new URLSearchParams(search).get('code') || '';

  return (
    <div className="relative">
      <section className="relative overflow-hidden aurora-bg border-b border-slate-200/70">
        <div className="absolute inset-0 wp-grid opacity-70" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-14 pb-10 text-center">
          <span className="text-xs font-mono uppercase tracking-widest text-red-600 font-semibold">Track shipment</span>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Where's my parcel?
          </h1>
          <p className="mt-3 text-slate-600 max-w-xl mx-auto">
            Look up realtime updates for any GO DISPATCH delivery by tracking code or phone number.
          </p>
        </div>
      </section>

      <TrackingView initialTrackingCode={initialCode} />
    </div>
  );
}
