/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import TrackingView from './TrackingView.js';
import { useRouter } from '../router.js';

/**
 * The tracking page.
 *
 * The header is deliberately small: this page exists to answer one question,
 * and the search box is the answer's front door. A gradient hero would push the
 * box below the fold on the phone this is mostly used from.
 */
export default function TrackPage() {
  const { search } = useRouter();
  const initialCode = new URLSearchParams(search).get('code') || '';

  return (
    <div className="animate-in fade-in duration-300">
      <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-14 pb-8 sm:pt-20 sm:pb-10">
        <span className="font-mono text-xs uppercase tracking-widest text-red-600">Tracking</span>
        <h1 className="mt-4 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
          Where's my parcel?
        </h1>
        <p className="mt-3 text-lg text-slate-600 max-w-[52ch]">
          Enter the code you were given at booking, or the phone number you booked with.
        </p>
      </header>

      <TrackingView initialTrackingCode={initialCode} />
    </div>
  );
}
