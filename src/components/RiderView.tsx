/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Truck,
  Navigation,
  Phone,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Banknote,
  ArrowRight,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { RiderJob, OrderStatus } from '../types.js';

/**
 * The courier's screen.
 *
 * Read one-handed, outdoors, in sunlight, by somebody who has stopped a
 * motorbike to look at it. Everything here follows from that.
 *
 * ONE LEG AT A TIME. A job has two ends, but never both at once: before
 * collection the only thing that matters is the sender's address, and from the
 * moment the parcel is in the bag it is the recipient's. So the screen shows
 * the half being worked on, at a size that can be read at arm's length, and
 * folds the other half into a line that can be opened if needed. The old
 * version gave pickup, dropoff and parcel three identical cards, which meant
 * hunting for the relevant one on every glance.
 *
 * NAVIGATE IS THE POINT. The first thing a courier does with an address is
 * open it in Maps. Before this it was plain text to be copied out by hand.
 *
 * Contrast over decoration: no grey lighter than slate-600 for anything that
 * has to be read, borders rather than shadows, and every target at least 48px.
 */

const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; hint: string }>> = {
  queued: { label: 'I have collected it', hint: 'Press once the parcel is in your hands.' },
  picked_up: { label: 'On my way', hint: 'Press when you set off to the recipient.' },
  in_transit: { label: 'Delivered', hint: 'Press once the recipient has the parcel.' },
};

const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  awaiting_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  queued: 'To collect',
  picked_up: 'Collected',
  in_transit: 'On the road',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/**
 * A maps link for an address as people here actually write them — a landmark
 * and a neighbourhood, not a street number. A free-text search handles that;
 * coordinates we do not have would handle it better, and we do not have them.
 */
function mapsUrl(address: string, region?: string): string {
  const query = [address, region, 'Ghana'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function RiderView({ token }: { token: string }) {
  const [job, setJob] = useState<RiderJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [collecting, setCollecting] = useState(false);

  const loadJob = async () => {
    try {
      const res = await fetch(`/api/rider/${encodeURIComponent(token)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'This delivery link is not valid.');
      }
      setJob(await res.json());
      setError('');
    } catch (err: any) {
      setError(err.message || 'Could not load this delivery.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const advance = async () => {
    setWorking(true);
    try {
      const res = await fetch(`/api/rider/${encodeURIComponent(token)}/status`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update this parcel.');
      await loadJob();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };

  const collect = async () => {
    setCollecting(true);
    try {
      const res = await fetch(`/api/rider/${encodeURIComponent(token)}/collect`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not record the payment.');
      await loadJob();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCollecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-[var(--wp-bg)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="min-h-dvh bg-[var(--wp-bg)] flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-2xl border-2 border-slate-300 bg-white p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Link not valid</h1>
          <p className="mt-2 text-base text-slate-700">{error}</p>
          <p className="mt-4 text-base text-slate-600">Ask dispatch to send your link again.</p>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const action = NEXT_ACTION[job.status];
  const isDone = job.status === 'delivered';
  const isCancelled = job.status === 'cancelled';

  /**
   * Which end of the job is live. `queued` means it is still with the sender;
   * anything past that means it is in the courier's hands and the only address
   * that matters is where it is going.
   */
  const leg: 'pickup' | 'dropoff' | null =
    job.status === 'queued'
      ? 'pickup'
      : job.status === 'picked_up' || job.status === 'in_transit'
        ? 'dropoff'
        : null;

  const here =
    leg === 'pickup'
      ? {
          label: 'Collect from',
          name: job.senderName,
          phone: job.senderPhone,
          address: job.pickupAddress,
          notes: job.pickupNotes,
          region: undefined as string | undefined,
        }
      : {
          label: 'Deliver to',
          name: job.recipientName,
          phone: job.recipientPhone,
          address: job.dropoffAddress,
          notes: job.dropoffNotes,
          region: job.destinationRegion,
        };

  const other =
    leg === 'pickup'
      ? {
          label: 'Then deliver to',
          name: job.recipientName,
          phone: job.recipientPhone,
          address: job.dropoffAddress,
          notes: job.dropoffNotes,
          region: job.destinationRegion,
        }
      : {
          label: 'Collected from',
          name: job.senderName,
          phone: job.senderPhone,
          address: job.pickupAddress,
          notes: job.pickupNotes,
          region: undefined as string | undefined,
        };

  const firstName = (full: string) => (full || '').trim().split(/\s+/)[0] || full;

  /**
   * Whether the money changes hands on THIS leg.
   *
   * A sender who is paying settles when the parcel is handed over; a recipient
   * who is paying settles at their door. Offering "I have the money" on the
   * wrong leg invites a courier to mark a payment they have not been given,
   * which the ledger then believes.
   */
  const collectHere =
    job.cashToCollect &&
    ((job.payer === 'sender' && leg === 'pickup') || (job.payer !== 'sender' && leg === 'dropoff'));

  return (
    <div className="min-h-dvh bg-[var(--wp-bg)] text-slate-900 font-sans pb-36">
      <header className="px-5 pt-5 pb-4 text-white" style={{ background: 'var(--wp-grad)' }}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-white/85">
            <Truck className="h-4 w-4" />
            <span className="font-mono text-xs uppercase tracking-[0.16em]">GO DISPATCH</span>
          </span>
          <span className="rounded-lg bg-white/20 px-2.5 py-1 text-sm font-semibold">
            {STATUS_LABEL[job.status] ?? job.status}
          </span>
        </div>
        <p className="mt-2 font-mono text-xl font-semibold">{job.trackingCode}</p>
      </header>

      <main className="px-4 pt-5 space-y-4">
        {error && (
          <div role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <span className="text-base text-red-800">{error}</span>
          </div>
        )}

        {leg ? (
          <>
            {/* The half of the job being worked on, at a size readable at
                arm's length in daylight. */}
            <section>
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                {here.label}
              </p>
              <h1 className="mt-1.5 text-3xl font-bold leading-[1.15] tracking-tight text-slate-900">
                {here.address}
              </h1>
              {here.notes && (
                <p className="mt-2 text-lg leading-snug text-slate-800">{here.notes}</p>
              )}
              <p className="mt-2 text-base text-slate-700">{here.name}</p>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <a
                  href={mapsUrl(here.address, here.region)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-aurora flex min-h-14 items-center justify-center gap-2 rounded-xl text-base font-semibold text-white"
                >
                  <Navigation className="h-5 w-5" />
                  Navigate
                </a>
                <a
                  href={`tel:${here.phone}`}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-white text-base font-semibold text-slate-900"
                >
                  <Phone className="h-5 w-5" />
                  Call {firstName(here.name)}
                </a>
              </div>
            </section>

            {/* The other end, folded away. Built on <details> so it needs no
                state of its own and survives a re-render mid-job. */}
            <details className="group rounded-xl border-2 border-slate-200 bg-white">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-600">{other.label}</span>
                  <span className="block truncate text-base font-semibold text-slate-900">
                    {other.address}
                  </span>
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t-2 border-slate-100 px-4 py-3.5 space-y-3">
                {other.notes && <p className="text-base text-slate-800">{other.notes}</p>}
                <p className="text-base text-slate-700">{other.name}</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <a
                    href={mapsUrl(other.address, other.region)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white text-base font-medium text-slate-900"
                  >
                    <Navigation className="h-4 w-4" />
                    Map
                  </a>
                  <a
                    href={`tel:${other.phone}`}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white text-base font-medium text-slate-900"
                  >
                    <Phone className="h-4 w-4" />
                    Call
                  </a>
                </div>
              </div>
            </details>
          </>
        ) : (
          <section className="rounded-xl border-2 border-slate-200 bg-white p-4">
            <p className="text-base text-slate-700">
              {isDone
                ? `Delivered to ${job.recipientName}.`
                : isCancelled
                  ? 'This job was cancelled. Do not collect it.'
                  : 'Dispatch has not released this parcel yet.'}
            </p>
          </section>
        )}

        {/* Money. Only ever shown when there is money to take. */}
        {collectHere ? (
          <section className="rounded-xl border-2 border-red-600 bg-red-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-red-800">
              <Banknote className="h-4 w-4" />
              Collect at the door
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-red-900">
              {job.currency} {(job.priceAmount / 100).toFixed(2)}
            </p>
            <p className="mt-1 text-base text-red-800">
              From the {job.payer === 'recipient' ? 'recipient' : 'sender'}.
            </p>
            <button
              onClick={collect}
              disabled={collecting}
              className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-base font-semibold text-white disabled:opacity-60"
            >
              {collecting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              I have the money
            </button>
          </section>
        ) : job.cashToCollect ? (
          // Money is due, but not on this leg. Worth knowing about, not worth
          // a button that would record it early.
          <p className="flex items-center gap-2 px-1 text-base text-slate-700">
            <Banknote className="h-5 w-5 shrink-0 text-slate-500" />
            {job.currency} {(job.priceAmount / 100).toFixed(2)} to collect from the{' '}
            {job.payer === 'sender' ? 'sender' : 'recipient'}
            {job.payer === 'sender' ? ' now' : ' at the door'}.
          </p>
        ) : job.paymentStatus === 'paid' ? (
          <p className="flex items-center gap-2 px-1 text-base font-medium text-emerald-800">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            Paid already — collect nothing.
          </p>
        ) : null}

        {/* What is being carried. One line, because a courier checks it once. */}
        <p className="px-1 text-base text-slate-700">
          {job.packageWeightKg}kg · {job.packageDescription}
        </p>
      </main>

      {/* The one action, always in reach of a thumb. */}
      <div className="fixed inset-x-0 bottom-0 border-t-2 border-slate-200 bg-white px-4 pb-5 pt-4">
        {isDone ? (
          <p className="flex items-center justify-center gap-2 py-3 text-lg font-semibold text-emerald-800">
            <CheckCircle2 className="h-6 w-6" />
            Job complete
          </p>
        ) : isCancelled ? (
          <p className="flex items-center justify-center gap-2 py-3 text-lg font-semibold text-red-700">
            <AlertCircle className="h-6 w-6" />
            Cancelled
          </p>
        ) : action ? (
          <>
            <button
              onClick={advance}
              disabled={working}
              className="btn-aurora flex min-h-16 w-full items-center justify-center gap-2.5 rounded-2xl text-lg font-semibold text-white disabled:opacity-60"
            >
              {working ? <Loader2 className="h-6 w-6 animate-spin" /> : <ArrowRight className="h-6 w-6" />}
              {action.label}
            </button>
            <p className="mt-2 text-center text-base text-slate-600">{action.hint}</p>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 py-3 text-base text-slate-600">
            <Clock className="h-5 w-5" />
            Nothing to do yet — dispatch will release it.
          </p>
        )}
      </div>
    </div>
  );
}
