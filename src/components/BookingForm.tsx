/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle,
  Copy,
  Check,
  Loader2,
  Plus,
  Trash2,
  Package,
  AlertCircle,
} from 'lucide-react';
import { PricingConfig } from '../types.js';
import RegionPicker from './RegionPicker.js';
import WhenPicker from './WhenPicker.js';
import { isRegion } from '../regions.js';
import { quote, formatAmount, DEFAULT_PRICING } from '../pricing.js';

interface BookingFormProps {
  onSuccessBooking: (trackingCode: string) => void;
  /** Preselected from the map on the home page. */
  initialRegion?: string;
}

interface ParcelDraft {
  key: number;
  destinationRegion: string;
  dropoffAddress: string;
  recipientName: string;
  recipientPhone: string;
  packageWeightKg: string;
  packageDescription: string;
}

interface BookedParcel {
  trackingCode: string;
  destinationRegion?: string;
  recipientName: string;
  priceAmount: number;
  currency: string;
}

const blankParcel = (key: number, region = ''): ParcelDraft => ({
  key,
  destinationRegion: region,
  dropoffAddress: '',
  recipientName: '',
  recipientPhone: '',
  packageWeightKg: '1',
  packageDescription: '',
});

/**
 * Booking, in three steps.
 *
 * The shape follows how the office works rather than how the table is laid
 * out: one sender and one collection, then any number of parcels going to
 * different regions, then a review.
 *
 * Two things are stated plainly rather than buried, because they are the two
 * that would otherwise cause an argument at the counter:
 *
 *  - Every price here is an ESTIMATE. Parcels are weighed at the office and
 *    the weighed figure is what is charged.
 *  - The bill is settled after weighing at the office, by whoever the parcel
 *    names as payer, and nothing goes on a bus until it is. There is no payment step
 *    because the sender is not being asked for money.
 */
/**
 * A key for one filled-in form. randomUUID needs a secure context — true for
 * https and for localhost, false for a phone hitting a dev machine over the
 * LAN, which is exactly where this gets tested.
 */
function newKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function BookingForm({ onSuccessBooking, initialRegion = '' }: BookingFormProps) {
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [submitting, setSubmitting] = useState(false);

  /**
   * One key per filled-in form, not per submit.
   *
   * It is a ref rather than state precisely so that re-rendering cannot change
   * it: every retry of this booking must carry the same value, or the server
   * has no way to tell a retry from a second booking. A new one is minted only
   * after a booking succeeds, because at that point the next submit really is
   * a different parcel.
   *
   * This matters here more than on most forms. The server sleeps after fifteen
   * idle minutes, so the first booking of the morning sits on a spinner for
   * about a minute, and a spinner that long is a button people press again.
   */
  const idempotencyKey = useRef(newKey());
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 3;
  const TITLES = ['Where do we collect?', 'What are you sending?', 'Check and confirm'];
  const BLURBS = [
    'We collect anywhere in Accra.',
    'Add a parcel for each place it is going.',
    'Prices are estimates until we weigh them.',
  ];

  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [scheduledPickup, setScheduledPickup] = useState('');

  const [parcels, setParcels] = useState<ParcelDraft[]>([
    blankParcel(1, isRegion(initialRegion) ? initialRegion : ''),
  ]);
  const [nextKey, setNextKey] = useState(2);

  const [result, setResult] = useState<{
    reference: string;
    parcels: BookedParcel[];
    estimatedTotal: number;
    currency: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/pricing')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPricing(d))
      .catch(() => {});

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const tz = tomorrow.getTimezoneOffset() * 60000;
    setScheduledPickup(new Date(tomorrow.getTime() - tz).toISOString().slice(0, 16));
  }, []);

  const patch = (key: number, f: keyof ParcelDraft, value: string) =>
    setParcels((list) => list.map((p) => (p.key === key ? { ...p, [f]: value } : p)));

  const addParcel = () => {
    setParcels((list) => [...list, blankParcel(nextKey)]);
    setNextKey((n) => n + 1);
  };

  const removeParcel = (key: number) =>
    setParcels((list) => (list.length > 1 ? list.filter((p) => p.key !== key) : list));

  const estimateFor = (p: ParcelDraft) => quote(Number(p.packageWeightKg), pricing).total;
  const estimatedTotal = parcels.reduce((sum, p) => sum + estimateFor(p), 0);

  const validate = (s: number): string => {
    if (s === 1) {
      if (!senderName.trim()) return 'Your name is required';
      if (!senderPhone.trim()) return 'Your phone number is required';
      if (!pickupAddress.trim()) return 'Pickup address is required';
      if (!scheduledPickup) return 'Choose when we should collect';
    }
    if (s === 2) {
      for (let i = 0; i < parcels.length; i++) {
        const p = parcels[i];
        const at = `Parcel ${i + 1}: `;
        if (!p.destinationRegion) return `${at}choose the region it is going to`;
        if (!p.dropoffAddress.trim()) return `${at}recipient's address is required`;
        if (!p.recipientName.trim()) return `${at}recipient's name is required`;
        if (!p.recipientPhone.trim()) return `${at}recipient's phone number is required`;
        if (!(Number(p.packageWeightKg) > 0)) return `${at}give us a rough weight`;
        if (!p.packageDescription.trim()) return `${at}say briefly what is inside`;
      }
    }
    return '';
  };

  const goNext = () => {
    const err = validate(step);
    if (err) { setError(err); return; }
    setError('');
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setError('');
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(1) || validate(2);
    if (err) { setError(err); return; }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName,
          senderPhone,
          pickupAddress,
          pickupNotes,
          scheduledPickupAt: new Date(scheduledPickup).toISOString(),
          idempotencyKey: idempotencyKey.current,
          parcels: parcels.map((p) => ({
            destinationRegion: p.destinationRegion,
            dropoffAddress: p.dropoffAddress,
            recipientName: p.recipientName,
            recipientPhone: p.recipientPhone,
            packageWeightKg: Number(p.packageWeightKg),
            packageDescription: p.packageDescription,
          })),
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'That booking could not be submitted.');

      // Booked. The next submit from this page would be a genuinely new
      // booking, so it needs a key of its own.
      idempotencyKey.current = newKey();

      setResult({
        reference: body.reference,
        parcels: body.parcels ?? [],
        estimatedTotal: body.estimatedTotal ?? 0,
        currency: body.currency ?? 'GHS',
      });
      onSuccessBooking(body.parcels?.[0]?.trackingCode ?? body.reference);
    } catch (err: any) {
      setError(err.message || 'That booking could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyReference = (value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => {}
    );
  };

  const field =
    'w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 px-4 py-3 text-base outline-none focus:border-red-500 focus:bg-white focus:ring-1 focus:ring-red-500 placeholder-slate-400 transition-colors';
  const label = 'block text-sm font-medium text-slate-500 mb-1';

  /* ---------------- confirmation ---------------- */
  if (result) {
    const single = result.parcels.length === 1;
    /** The code we put in front of them, and the one the copy button copies. */
    const headline = single ? result.parcels[0].trackingCode : result.reference;

    return (
      <div className="mx-auto max-w-2xl px-4 py-8" id="booking_success_container">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle className="h-8 w-8" />
          </div>

          <h2 className="mt-5 font-display text-2xl font-semibold text-slate-900">
            {result.parcels.length === 1 ? 'Parcel booked' : `${result.parcels.length} parcels booked`}
          </h2>
          <p className="mt-2 text-slate-600">
            A rider will come to your address and collect. We weigh each parcel back at
            the office and text you the bill — once it is settled the parcel goes on an
            intercity bus, and whoever is receiving it collects it at the station.
          </p>

          {/* One parcel needs one code, and it is the tracking code. Leading
              with a booking reference here handed people two numbers where one
              would do, and only one of them is the one they will be asked for.
              Several parcels genuinely travel apart — different riders,
              different days, different buses — so each keeps its own code and
              the reference is the thing that holds the set together. Either
              one works in the tracking box. */}
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm text-slate-500">
                {single ? 'Your tracking code' : 'Your booking reference'}
              </span>
              <span className="block font-mono text-xl font-semibold text-slate-900">
                {headline}
              </span>
              <span className="mt-1.5 block text-sm text-slate-500">
                {single
                  ? 'Track with this, or with the phone number you gave us.'
                  : `Follows all ${result.parcels.length} parcels at once. Each has its own code as well.`}
              </span>
            </span>
            <button
              onClick={() => copyReference(headline)}
              aria-label={single ? 'Copy tracking code' : 'Copy booking reference'}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <ul className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
            {result.parcels.map((p) => (
              <li key={p.trackingCode} className="py-3 flex items-center justify-between gap-3">
                <span className="min-w-0">
                  {/* Repeating the code a single-parcel booking already leads
                      with would just be the same number twice. */}
                  {!single && (
                    <span className="block font-mono text-base font-medium text-slate-900">
                      {p.trackingCode}
                    </span>
                  )}
                  <span
                    className={
                      single
                        ? 'block text-base text-slate-700 truncate'
                        : 'block text-sm text-slate-500 truncate'
                    }
                  >
                    {p.destinationRegion} · {p.recipientName}
                  </span>
                </span>
                <span className="text-base font-medium text-slate-900 tabular-nums shrink-0">
                  ~{formatAmount(p.priceAmount, p.currency)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-slate-500">Estimated total</span>
            <span className="text-xl font-semibold text-slate-900 tabular-nums">
              ~{formatAmount(result.estimatedTotal, result.currency)}
            </span>
          </div>

          <p className="mt-4 text-base text-slate-500">
            Every figure here is an estimate from the weight you gave us. Each parcel is
            weighed once our rider brings it in, and that weighed price is what the
            recipient pays.
          </p>
        </div>
      </div>
    );
  }

  /* ---------------- the form ---------------- */
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <form onSubmit={submit} className="space-y-7">
        <div>
          <div
            className="flex gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-valuenow={step}
            aria-label={`Step ${step} of ${TOTAL_STEPS}`}
          >
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? 'bg-red-600' : 'bg-slate-200'}`} />
            ))}
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight text-balance">
              {TITLES[step - 1]}
            </h2>
            <span className="text-sm text-slate-500 shrink-0 tabular-nums">Step {step} of {TOTAL_STEPS}</span>
          </div>
          <p className="mt-1 text-slate-500">{BLURBS[step - 1]}</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-2.5" role="alert">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-base text-red-700">{error}</p>
          </div>
        )}

        {/* ---- 1. Collection ---- */}
        <div className={step === 1 ? 'space-y-4' : 'hidden'}>
          <div>
            <label htmlFor="b_name" className={label}>Your name *</label>
            <input id="b_name" className={field} value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="e.g. Ama Osei" />
          </div>
          <div>
            <label htmlFor="b_phone" className={label}>Your phone number *</label>
            <input id="b_phone" type="tel" className={field} value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} placeholder="e.g. 0244123456" />
          </div>
          <div>
            <label htmlFor="b_pickup" className={label}>Pickup address in Accra *</label>
            <textarea id="b_pickup" rows={2} className={`${field} resize-none`} value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="e.g. Block C, Airport Residential Area" />
          </div>
          <div>
            <label htmlFor="b_notes" className={label}>Landmark (optional)</label>
            <input id="b_notes" className={field} value={pickupNotes} onChange={(e) => setPickupNotes(e.target.value)} placeholder="e.g. Opposite the French School" />
          </div>
          <div>
            <label htmlFor="b_when" className={label}>When should we come? *</label>
            <WhenPicker id="b_when" value={scheduledPickup} onChange={setScheduledPickup} />
          </div>
        </div>

        {/* ---- 2. Parcels ---- */}
        <div className={step === 2 ? 'space-y-4' : 'hidden'}>
          {parcels.map((p, i) => (
            <div key={p.key} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <span className="flex items-center gap-2 text-base font-medium text-slate-900">
                  <Package className="h-4 w-4 text-red-600" />
                  Parcel {i + 1}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-base text-slate-500 tabular-nums">
                    ~{formatAmount(estimateFor(p), pricing.currency)}
                  </span>
                  {parcels.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeParcel(p.key)}
                      aria-label={`Remove parcel ${i + 1}`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </span>
              </div>

              <div>
                <label className={label}>Region it is going to *</label>
                <RegionPicker value={p.destinationRegion} onChange={(v) => patch(p.key, 'destinationRegion', v)} />
              </div>
              <div>
                {/* Not "Delivery address": nobody delivers to it. It is on
                    record so the office knows which town the parcel is bound
                    for, and so the recipient can be told where to collect. */}
                <label className={label}>Recipient&rsquo;s address in the region *</label>
                <textarea rows={2} className={`${field} resize-none`} value={p.dropoffAddress} onChange={(e) => patch(p.key, 'dropoffAddress', e.target.value)} placeholder="e.g. Lamashegu, near the Total station" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>Recipient&rsquo;s name *</label>
                  <input className={field} value={p.recipientName} onChange={(e) => patch(p.key, 'recipientName', e.target.value)} placeholder="e.g. Kofi Mensah" />
                </div>
                <div>
                  <label className={label}>Recipient&rsquo;s phone *</label>
                  <input type="tel" className={field} value={p.recipientPhone} onChange={(e) => patch(p.key, 'recipientPhone', e.target.value)} placeholder="e.g. 0207987654" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>Rough weight (kg) *</label>
                  <input type="number" min="0.1" max="100" step="0.1" className={field} value={p.packageWeightKg} onChange={(e) => patch(p.key, 'packageWeightKg', e.target.value)} />
                </div>
                <div>
                  <label className={label}>What is inside? *</label>
                  <input className={field} value={p.packageDescription} onChange={(e) => patch(p.key, 'packageDescription', e.target.value)} placeholder="e.g. documents" />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addParcel}
            className="w-full min-h-14 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-base font-medium text-slate-600 hover:border-red-300 hover:text-red-700 hover:bg-red-50/40 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add another parcel
          </button>

          <p className="text-base text-slate-500">
            Each parcel gets its own tracking code and can go to a different region. Each
            one is weighed and billed on its own, and each is paid for before it travels.
          </p>
        </div>

        {/* ---- 3. Review ---- */}
        <div className={step === 3 ? 'space-y-4' : 'hidden'}>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-medium text-slate-500">Collection</h3>
            <p className="mt-1 text-base text-slate-900">{senderName || '—'} · {senderPhone}</p>
            <p className="text-base text-slate-600">{pickupAddress}</p>
            <p className="text-base text-slate-500 mt-1">
              {scheduledPickup ? new Date(scheduledPickup).toLocaleString() : ''}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <ul className="divide-y divide-slate-200">
              {parcels.map((p, i) => (
                <li key={p.key} className="p-4 flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-base font-medium text-slate-900">
                      Parcel {i + 1} · {p.destinationRegion || '—'}
                    </span>
                    <span className="block text-sm text-slate-500 truncate">
                      {p.recipientName} · {p.dropoffAddress}
                    </span>
                    <span className="block text-sm text-slate-400">
                      {p.packageWeightKg}kg · {p.packageDescription}
                    </span>
                  </span>
                  <span className="text-base text-slate-900 tabular-nums shrink-0">
                    ~{formatAmount(estimateFor(p), pricing.currency)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="p-4 bg-slate-50 flex items-baseline justify-between">
              <span className="text-slate-600">Estimated total</span>
              <span className="text-xl font-semibold text-slate-900 tabular-nums">
                ~{formatAmount(estimatedTotal, pricing.currency)}
              </span>
            </div>
          </div>

          {/* The two facts most likely to cause an argument later. */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
            <p className="text-base text-amber-900">
              <strong className="font-semibold">This is an estimate.</strong> Our rider
              collects from you, we weigh each parcel back at the office, and that weighed
              price is the one charged.
            </p>
            <p className="text-base text-amber-900">
              <strong className="font-semibold">The recipient pays, before it travels.</strong>{' '}
              We text them the bill once the parcel has been weighed. It goes on the bus once
              that is settled — nothing travels unpaid.
            </p>
            <p className="text-base text-amber-900">
              <strong className="font-semibold">They collect it at the station.</strong> An
              intercity bus carries it and we text you both the registration. We are not a
              door-to-door service.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              className="min-h-12 px-5 rounded-xl border border-slate-200 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Back
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button type="button" onClick={goNext} className="gd-submit flex-1">
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="submit" id="btn_submit_booking" disabled={submitting} className="gd-submit flex-1">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Booking…' : `Book ${parcels.length === 1 ? 'this parcel' : `${parcels.length} parcels`}`}
            </button>
          )}

          {step === 2 && (
            <span className="hidden sm:block text-right shrink-0">
              <span className="block text-sm text-slate-500">Estimate</span>
              <span className="block text-lg font-semibold text-slate-900 tabular-nums">
                ~{formatAmount(estimatedTotal, pricing.currency)}
              </span>
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
