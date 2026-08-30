/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Truck,
  MapPin,
  Phone,
  Package,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Banknote,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { RiderJob, OrderStatus } from '../types.js';
import { formatPhone } from '../phone.js';

/**
 * THE COLLECTION LEG, and nothing else.
 *
 * A courier's whole job on this screen is: take the parcel from the sender,
 * bring it to the office. What happens after -- weighing, the bill, the run to
 * the station, the bus -- is office work, and the last of those needs a car
 * number typed where somebody can read it back.
 */
const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; hint: string }>> = {
  queued: { label: 'Mark collected', hint: 'Confirm once the parcel is in your hands.' },
  picked_up: { label: 'Dropped at the office', hint: 'Confirm once you have handed it over.' },
};

const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  queued: 'Ready for collection',
  picked_up: 'Collected',
  at_office: 'At the office',
  paid: 'Paid',
  to_station: 'Going to the station',
  dispatched: 'On the bus',
  cancelled: 'Cancelled',
  // Retired with the door-delivery model; an old link can still land on one.
  awaiting_payment: 'Awaiting payment',
  in_transit: 'In transit',
  delivered: 'Delivered',
};

export default function RiderView({ token }: { token: string }) {
  const [job, setJob] = useState<RiderJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

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

  // ---------- loading / invalid link ----------
  if (loading) {
    return (
      <div className="min-h-dvh bg-[var(--wp-bg)] flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-red-600" />
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="min-h-dvh bg-[var(--wp-bg)] flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto h-9 w-9 text-red-500" />
          <h1 className="mt-3 text-lg font-medium text-slate-900">Link not valid</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <p className="mt-4 text-sm text-slate-400">Ask dispatch to resend your delivery link.</p>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const action = NEXT_ACTION[job.status];
  // Done, from this screen's point of view: the parcel is at the office and the
  // courier's part in it is over. What follows is not theirs to drive.
  const isDone = !action && job.status !== 'cancelled';
  const isCancelled = job.status === 'cancelled';

  return (
    <div className="min-h-dvh bg-[var(--wp-bg)] text-slate-900 font-sans pb-32">
      {/* Header */}
      <header className="text-white px-5 pt-6 pb-8" style={{ background: 'var(--wp-grad)' }}>
        <div className="flex items-center gap-2 text-white/80">
          <Truck className="h-4 w-4" />
          <span className="text-xs font-mono uppercase tracking-[0.16em]">GO DISPATCH courier</span>
        </div>
        <h1 className="mt-3 font-mono text-2xl font-medium">{job.trackingCode}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/20 backdrop-blur px-2.5 py-1 text-xs font-medium">
            {STATUS_LABEL[job.status] ?? job.status}
          </span>
          {job.riderName && <span className="text-xs text-white/80">Assigned to {job.riderName}</span>}
        </div>
      </header>

      <main className="px-4 -mt-4 space-y-3">
        {/* NO CASH ON THIS SCREEN.
            A courier used to be able to record money taken at a door. Nobody
            pays at a door: the parcel is weighed at the office, billed by SMS
            and settled by MoMo before it goes anywhere. A button here would
            only be a way to mark a parcel paid that nobody had paid for. */}

        {job.paymentStatus === 'paid' && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">Paid for.</span>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Pickup */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-100 text-xs font-semibold text-red-700">P</span>
            <h2 className="text-sm font-medium text-slate-900">Pickup</h2>
          </div>
          <p className="text-sm font-medium text-slate-900">{job.senderName}</p>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            {job.pickupAddress}
          </p>
          {job.pickupNotes && <p className="mt-1 pl-5.5 text-sm italic text-slate-500">{job.pickupNotes}</p>}
          <a
            href={`tel:${job.senderPhone}`}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700"
          >
            <Phone className="h-4 w-4 text-red-600" />
            {formatPhone(job.senderPhone)}
          </a>
        </section>

        {/* Dropoff */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-xs font-semibold text-sky-700">D</span>
            <h2 className="text-sm font-medium text-slate-900">Dropoff</h2>
          </div>
          <p className="text-sm font-medium text-slate-900">{job.recipientName}</p>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            {job.dropoffAddress}
          </p>
          {job.dropoffNotes && <p className="mt-1 pl-5.5 text-sm italic text-slate-500">{job.dropoffNotes}</p>}
          <a
            href={`tel:${job.recipientPhone}`}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700"
          >
            <Phone className="h-4 w-4 text-red-600" />
            {formatPhone(job.recipientPhone)}
          </a>
        </section>

        {/* Parcel */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-red-600" />
            <h2 className="text-sm font-medium text-slate-900">Parcel</h2>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Size</dt>
            <dd className="text-right font-medium capitalize text-slate-900">{job.packageSize}</dd>
            <dt className="text-slate-500">Weight</dt>
            <dd className="text-right font-medium text-slate-900 tabular-nums">{job.packageWeightKg} kg</dd>
            <dt className="text-slate-500">Pickup by</dt>
            <dd className="text-right font-medium text-slate-900">
              {new Date(job.scheduledPickupAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </dd>
          </dl>
          <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">{job.packageDescription}</p>
        </section>
      </main>

      {/* Sticky primary action */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/90 backdrop-blur-xl px-4 py-4">
        {isDone ? (
          <div className="flex items-center justify-center gap-2 py-2 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Delivered — job complete</span>
          </div>
        ) : isCancelled ? (
          <div className="flex items-center justify-center gap-2 py-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">This job was cancelled</span>
          </div>
        ) : action ? (
          <>
            <button
              onClick={advance}
              disabled={working}
              className="btn-aurora flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-medium text-white disabled:opacity-60"
            >
              {working ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              {action.label}
            </button>
            <p className="mt-2 text-center text-sm text-slate-500">{action.hint}</p>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-slate-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Waiting on dispatch — nothing to do yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}
