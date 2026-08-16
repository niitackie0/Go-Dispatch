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

const NEXT_ACTION: Partial<Record<OrderStatus, { label: string; hint: string }>> = {
  queued: { label: 'Mark picked up', hint: 'Confirm once the parcel is in your hands.' },
  picked_up: { label: 'Start transit', hint: 'Confirm once you are on the road.' },
  in_transit: { label: 'Mark delivered', hint: 'Confirm once the recipient has the parcel.' },
};

const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  awaiting_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  queued: 'Ready for pickup',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

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

  // ---------- loading / invalid link ----------
  if (loading) {
    return (
      <div className="min-h-dvh bg-[#F5F8FE] flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="min-h-dvh bg-[#F5F8FE] flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto h-9 w-9 text-red-500" />
          <h1 className="mt-3 text-lg font-semibold text-slate-900">Link not valid</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <p className="mt-4 text-sm text-slate-400">Ask dispatch to resend your delivery link.</p>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const action = NEXT_ACTION[job.status];
  const isDone = job.status === 'delivered';
  const isCancelled = job.status === 'cancelled';

  return (
    <div className="min-h-dvh bg-[#F5F8FE] text-slate-900 font-sans pb-32">
      {/* Header */}
      <header className="text-white px-5 pt-6 pb-8" style={{ background: 'var(--wp-grad)' }}>
        <div className="flex items-center gap-2 text-white/80">
          <Truck className="h-4 w-4" />
          <span className="text-xs font-mono uppercase tracking-[0.16em]">Waypoint courier</span>
        </div>
        <h1 className="mt-3 font-mono text-2xl font-semibold">{job.trackingCode}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/20 backdrop-blur px-2.5 py-1 text-xs font-semibold">
            {STATUS_LABEL[job.status] ?? job.status}
          </span>
          {job.riderName && <span className="text-xs text-white/80">Assigned to {job.riderName}</span>}
        </div>
      </header>

      <main className="px-4 -mt-4 space-y-3">
        {/* Cash to collect */}
        {job.cashToCollect && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
            <Banknote className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Collect {job.currency} {(job.priceAmount / 100).toFixed(2)}
              </p>
              <p className="mt-0.5 text-sm text-amber-800">
                Payable by the {job.payer === 'recipient' ? 'recipient at dropoff' : 'sender'}.
              </p>
              <button
                onClick={collect}
                disabled={collecting}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {collecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Payment collected
              </button>
            </div>
          </div>
        )}

        {job.paymentStatus === 'paid' && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">Already paid — collect nothing.</span>
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
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">P</span>
            <h2 className="text-sm font-semibold text-slate-900">Pickup</h2>
          </div>
          <p className="text-sm font-medium text-slate-900">{job.senderName}</p>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            {job.pickupAddress}
          </p>
          {job.pickupNotes && <p className="mt-1 pl-5.5 text-sm italic text-slate-500">{job.pickupNotes}</p>}
          <a
            href={`tel:${job.senderPhone}`}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
          >
            <Phone className="h-4 w-4 text-violet-600" />
            {job.senderPhone}
          </a>
        </section>

        {/* Dropoff */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-xs font-bold text-sky-700">D</span>
            <h2 className="text-sm font-semibold text-slate-900">Dropoff</h2>
          </div>
          <p className="text-sm font-medium text-slate-900">{job.recipientName}</p>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            {job.dropoffAddress}
          </p>
          {job.dropoffNotes && <p className="mt-1 pl-5.5 text-sm italic text-slate-500">{job.dropoffNotes}</p>}
          <a
            href={`tel:${job.recipientPhone}`}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
          >
            <Phone className="h-4 w-4 text-violet-600" />
            {job.recipientPhone}
          </a>
        </section>

        {/* Parcel */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-slate-900">Parcel</h2>
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
            <span className="font-semibold">Delivered — job complete</span>
          </div>
        ) : isCancelled ? (
          <div className="flex items-center justify-center gap-2 py-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span className="font-semibold">This job was cancelled</span>
          </div>
        ) : action ? (
          <>
            <button
              onClick={advance}
              disabled={working}
              className="btn-aurora flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white disabled:opacity-60"
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
