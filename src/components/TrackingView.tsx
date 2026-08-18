/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Search, ArrowRight, AlertCircle, Loader2, Phone } from 'lucide-react';
import { OrderStatus } from '../types.js';
import { CONTACT_PHONE, CONTACT_PHONE_E164 } from '../brand.js';

interface TrackingViewProps {
  initialTrackingCode?: string;
}

interface PublicOrder {
  id: string;
  trackingCode: string;
  senderName: string;
  recipientName: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageSize: string;
  packageDescription: string;
  scheduledPickupAt: string;
  status: OrderStatus;
  paymentStatus: string;
  createdAt: string;
  timeline: {
    status: OrderStatus;
    note?: string;
    changedAt: string;
  }[];
}

/**
 * The journey, as a customer understands it.
 *
 * Six steps, named for what happened rather than for the status column that
 * records it — "Collected", not "picked_up". `awaiting_payment` is not a step:
 * a parcel waiting on payment has not moved, so it sits at Booked and says so
 * in the status line instead of inventing a seventh node.
 */
const STEPS: { key: OrderStatus; label: string; short: string }[] = [
  { key: 'requested', label: 'Booked', short: 'Booked' },
  { key: 'confirmed', label: 'Confirmed', short: 'Confirmed' },
  { key: 'queued', label: 'Rider assigned', short: 'Rider' },
  { key: 'picked_up', label: 'Collected', short: 'Collected' },
  { key: 'in_transit', label: 'On the road', short: 'On the road' },
  { key: 'delivered', label: 'Delivered', short: 'Delivered' },
];

/** Where on the rail this order sits. Cancelled orders are off the rail entirely. */
function stepIndex(status: OrderStatus): number {
  if (status === 'cancelled') return -1;
  if (status === 'awaiting_payment') return 0;
  const i = STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

/**
 * The one sentence that answers the question the page asks.
 *
 * Written per status rather than assembled from a label, because "Picked Up"
 * tells a customer what our database thinks, and "We have your parcel" tells
 * them what is happening to it.
 */
function statusLine(order: PublicOrder): string {
  switch (order.status) {
    case 'requested':
      return 'Booked. We are confirming the details now.';
    case 'awaiting_payment':
      return 'Waiting for your payment. We collect once it lands.';
    case 'confirmed':
      return 'Confirmed. A rider is assigned before collection.';
    case 'queued':
      return 'A rider is on the way to collect it.';
    case 'picked_up':
      return 'Collected. It is with us now.';
    case 'in_transit':
      return `On the road to ${order.dropoffAddress}.`;
    case 'delivered':
      return `Delivered to ${order.recipientName}.`;
    case 'cancelled':
      return 'This booking was cancelled.';
    default:
      return '';
  }
}

const STATUS_TONE: Partial<Record<OrderStatus, string>> = {
  delivered: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700',
  cancelled: 'bg-red-500/10 border-red-500/20 text-red-700',
  in_transit: 'bg-red-500/10 border-red-500/20 text-red-700',
  awaiting_payment: 'bg-amber-500/10 border-amber-500/20 text-amber-700',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${d
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()}`;
}

/**
 * The rail: the whole journey in one line, including the part that has not
 * happened yet.
 *
 * It exists so the road below it does not have to carry the future. Six nodes
 * fit any width; the six labels do not, so below `sm` they give way to a single
 * "Step 4 of 6" line — the same information, in the space a phone actually has.
 */
function Rail({ current }: { current: number }) {
  const done = Math.max(0, current);
  const percent = STEPS.length > 1 ? (done / (STEPS.length - 1)) * 100 : 0;

  return (
    <div>
      <div className="relative" role="img" aria-label={`Step ${done + 1} of ${STEPS.length}: ${STEPS[done]?.label}`}>
        {/* The line the nodes sit on, and the part of it already travelled. */}
        <div className="absolute left-2 right-2 top-[7px] h-0.5 bg-slate-200" aria-hidden="true" />
        <div
          className="absolute left-2 top-[7px] h-0.5 bg-red-600 transition-[width] duration-500"
          style={{ width: `calc((100% - 1rem) * ${percent / 100})` }}
          aria-hidden="true"
        />

        <ol className="relative flex justify-between">
          {STEPS.map((step, i) => {
            const reached = i <= done;
            const isCurrent = i === done;
            return (
              <li key={step.key} className="flex flex-col items-center gap-2">
                <span
                  className={`h-4 w-4 rounded-full transition-colors ${
                    isCurrent
                      ? 'bg-white border-[3px] border-red-600 ring-3 ring-red-100'
                      : reached
                        ? 'bg-red-600'
                        : 'bg-white border-2 border-slate-200'
                  }`}
                />
                <span
                  className={`hidden sm:block text-center text-xs leading-tight max-w-[72px] ${
                    isCurrent ? 'font-semibold text-red-700' : reached ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {step.short}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="sm:hidden mt-3 text-[15px] text-slate-500">
        Step {done + 1} of {STEPS.length} —{' '}
        <span className="font-medium text-slate-900">{STEPS[done]?.label}</span>
      </p>
    </div>
  );
}

/**
 * The road: what has actually happened, in order, on the dashed line the brand
 * already uses for travel.
 *
 * It deliberately holds only real events. The old page drew the journey twice —
 * once as a stepper, again as "Verification Logs & Events" — and the second copy
 * grew without limit. Here the rail above owns the shape of the journey and this
 * owns the facts, so the card stays short: most parcels have three or four
 * events, and anything older folds away behind one line.
 */
function Road({ timeline }: { timeline: PublicOrder['timeline'] }) {
  const [showAll, setShowAll] = useState(false);
  const VISIBLE = 3;

  const hidden = Math.max(0, timeline.length - VISIBLE);
  const shown = showAll ? timeline : timeline.slice(hidden);

  if (timeline.length === 0) {
    return <p className="text-[15px] text-slate-500">Nothing has happened yet. We will update this as it moves.</p>;
  }

  return (
    <div>
      {hidden > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mb-3 min-h-11 text-sm font-medium text-red-700 hover:text-red-800 transition-colors cursor-pointer"
        >
          Show {hidden} earlier update{hidden === 1 ? '' : 's'}
        </button>
      )}

      <ol className="space-y-0">
        {shown.map((event, i) => {
          const isLatest = i === shown.length - 1;
          return (
            <li key={`${event.changedAt}-${i}`} className="flex gap-3.5">
              {/* Dot and the dashed road down to the next event. */}
              <div className="flex flex-col items-center shrink-0 w-4">
                <span
                  className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
                    isLatest ? 'bg-red-600 ring-3 ring-red-100' : 'bg-red-600/40'
                  }`}
                />
                {!isLatest && <span className="road-line w-0.5 flex-1 min-h-6" aria-hidden="true" />}
              </div>

              <div className={isLatest ? 'pb-0' : 'pb-5'}>
                <p className={`text-[15px] ${isLatest ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
                  {event.note || STEPS.find((s) => s.key === event.status)?.label || event.status.replace('_', ' ')}
                </p>
                <p className="text-[15px] text-slate-500 tabular-nums">{formatWhen(event.changedAt)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function TrackingView({ initialTrackingCode = '' }: TrackingViewProps) {
  const [searchQuery, setSearchQuery] = useState(initialTrackingCode);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PublicOrder[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialTrackingCode) {
      setSearchQuery(initialTrackingCode);
      handleTrack(undefined, initialTrackingCode);
    }
  }, [initialTrackingCode]);

  const handleTrack = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    const query = codeOverride || searchQuery;
    if (!query.trim()) return;

    setSearching(true);
    setError('');
    setResults(null);

    try {
      const res = await fetch(`/api/orders/track?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Nothing matches that code or number. Check it and try again.');
        }
        const data = await res.json();
        throw new Error(data.error || 'We could not look that up just now.');
      }
      setResults(await res.json());
    } catch (err: any) {
      setError(err.message || 'We could not look that up just now.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-20" id="tracking_view_container">
      {/* Search */}
      <div className="mb-10">
        <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            <input
              id="input_tracking_search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tracking code or phone number"
              className="w-full min-h-13 rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 placeholder-slate-400 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
            />
          </div>
          <button
            id="btn_tracking_search"
            type="submit"
            disabled={searching}
            className="min-h-13 rounded-xl btn-aurora text-white font-semibold px-7 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>{searching ? 'Looking' : 'Track'}</span>
            {!searching && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <p className="mt-3 text-[15px] text-slate-500">
          A tracking code looks like <span className="font-mono text-slate-700">GD-0000-000</span> and a
          booking reference like <span className="font-mono text-slate-700">GDB-0000-000</span>. Either
          works, as does the phone number the parcel was booked with.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[15px] text-red-800">{error}</p>
            <a
              href={`tel:${CONTACT_PHONE_E164}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-800"
            >
              <Phone className="h-3.5 w-3.5" />
              Call {CONTACT_PHONE}
            </a>
          </div>
        </div>
      )}

      {results && results.length > 1 && (
        <p className="mb-4 text-[15px] text-slate-500">
          {results.length} parcels booked on that number.
        </p>
      )}

      <div className="space-y-5">
        {results?.map((order) => {
          const current = stepIndex(order.status);
          const cancelled = order.status === 'cancelled';

          return (
            <article
              key={order.id}
              id={`tracking_result_${order.trackingCode}`}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
            >
              {/* Identity and route */}
              <div className="px-5 sm:px-7 py-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h2 className="font-mono text-xl font-semibold text-slate-900 tracking-tight">
                    {order.trackingCode}
                  </h2>
                  <p className="mt-1 text-[15px] text-slate-500">
                    {order.pickupAddress} <span className="text-slate-300 mx-0.5">&rarr;</span>{' '}
                    {order.dropoffAddress}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize ${
                    STATUS_TONE[order.status] ?? 'bg-slate-500/10 border-slate-500/20 text-slate-700'
                  }`}
                >
                  {order.status.replace('_', ' ')}
                </span>
              </div>

              {cancelled ? (
                <div className="px-5 sm:px-7 pb-6">
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="font-medium text-red-800">This booking was cancelled</p>
                    <p className="mt-1 text-[15px] text-red-700">
                      If that is not right, call {CONTACT_PHONE} with this tracking code and we
                      will sort it out.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* The rail — the whole journey, including what is still to come. */}
                  <div className="px-5 sm:px-7 pb-6 pt-1">
                    <Rail current={current} />
                  </div>

                  {/* The answer, in one line. */}
                  <div className="px-5 sm:px-7 py-5 border-t border-slate-200 bg-slate-50/60">
                    <p className="text-lg sm:text-xl font-medium text-slate-900 tracking-tight text-balance">
                      {statusLine(order)}
                    </p>
                    {order.paymentStatus !== 'paid' && (
                      <p className="mt-1.5 text-[15px] text-slate-500">
                        Payment is due on this parcel.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Facts. Deliberately short — a customer needs to recognise the
                  parcel, not audit it. */}
              <dl className="px-5 sm:px-7 py-5 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 text-[15px]">
                <div>
                  <dt className="text-sm text-slate-500">Sent by</dt>
                  <dd className="text-slate-900 truncate">{order.senderName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">For</dt>
                  <dd className="text-slate-900 truncate">{order.recipientName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Collection</dt>
                  <dd className="text-slate-900 tabular-nums">{formatWhen(order.scheduledPickupAt)}</dd>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-sm text-slate-500">Parcel</dt>
                  <dd className="text-slate-900">{order.packageDescription}</dd>
                </div>
              </dl>

              {/* The road — only what has happened. */}
              <div className="px-5 sm:px-7 py-5 border-t border-slate-200">
                <h3 className="text-sm font-medium text-slate-500 mb-4">What has happened</h3>
                <Road timeline={order.timeline} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
