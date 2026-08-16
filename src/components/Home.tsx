/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Truck,
  MapPin,
  ShieldCheck,
  PackageOpen,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Smartphone,
  Route,
  Boxes,
} from 'lucide-react';
import { Link } from '../router.js';
import { PricingConfig } from '../types.js';

const PIPELINE = [
  { label: 'Requested', desc: 'Order submitted' },
  { label: 'Confirmed', desc: 'Dispatch verified' },
  { label: 'Queued', desc: 'Rider assigned' },
  { label: 'Picked Up', desc: 'Parcel collected' },
  { label: 'In Transit', desc: 'On the road' },
  { label: 'Delivered', desc: 'Signed & done' },
];

const FEATURES = [
  {
    icon: Boxes,
    title: 'Flexible parcel sizing',
    body: 'Small pouches, medium courier cartons, and large heavy shipments — handled by dedicated motorcycle riders and vans.',
  },
  {
    icon: Route,
    title: 'Real-time status workflow',
    body: 'Follow your package from Requested and Confirmed through Picked Up, In Transit, and Delivered — no guessing.',
  },
  {
    icon: ShieldCheck,
    title: 'Audit-safe payments',
    body: 'Pay instantly with an MTN Mobile Money prompt, or settle manually with cash on pickup and bank transfer.',
  },
  {
    icon: MapPin,
    title: 'Metro-wide coverage',
    body: 'Operating fully across Accra, Tema, and Kumasi metropolitan areas, with same-day dispatch windows.',
  },
];

export default function Home() {
  const [pricing, setPricing] = useState<PricingConfig | null>(null);

  useEffect(() => {
    fetch('/api/pricing')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPricing(d))
      .catch(() => {});
  }, []);

  const tiers = [
    { key: 'small', name: 'Small', note: 'Fits in a courier pouch', hint: 'Documents, keys, small electronics' },
    { key: 'medium', name: 'Medium', note: 'Fits in a motorcycle box', hint: 'Cartons, parcels, retail orders' },
    { key: 'large', name: 'Large', note: 'Requires strapping / van', hint: 'Bulk cargo, heavy shipments' },
  ] as const;

  return (
    <div className="animate-in fade-in duration-300">
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden aurora-bg border-b border-slate-200/70">
        <div className="absolute inset-0 wp-grid opacity-70" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 backdrop-blur px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live across Accra, Tema &amp; Kumasi
              </div>

              <h1 className="mt-6 font-display text-4xl sm:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]">
                Send anything,
                <br />
                <span className="text-gradient">track everything.</span>
              </h1>

              <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-lg">
                Waypoint is a premium parcel dispatch network. Schedule a rider in minutes, follow
                each checkpoint with a tracking reference, and pay with Mobile Money or cash.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/book"
                  className="btn-aurora inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold hover:scale-[1.02]"
                >
                  Book a delivery
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/track"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 shadow-sm transition-colors"
                >
                  Track a shipment
                </Link>
              </div>

              {/* Trust points (qualitative, not fabricated metrics) */}
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Same-day dispatch</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> MoMo &amp; cash accepted</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Every step auditable</span>
              </div>
            </div>

            {/* Frosted-glass tracking card mockup */}
            <div className="relative">
              <div className="glass relative rounded-2xl p-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-slate-400 block">Tracking</span>
                    <span className="text-xl font-semibold font-mono text-slate-900">WP-8293-102</span>
                  </div>
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                    In Transit
                  </span>
                </div>

                <div className="py-5 space-y-4">
                  {PIPELINE.slice(0, 5).map((step, i) => {
                    const done = i < 4;
                    const current = i === 4;
                    return (
                      <div key={step.label} className="flex items-center gap-3">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            done
                              ? 'text-white'
                              : current
                              ? 'bg-sky-100 text-sky-600 border border-sky-300'
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}
                          style={done ? { background: 'var(--wp-grad)' } : undefined}
                        >
                          {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                        </div>
                        <div className="flex-1">
                          <span className={`text-sm font-semibold ${current ? 'text-sky-700' : done ? 'text-slate-900' : 'text-slate-400'}`}>
                            {step.label}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-400">{step.desc}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200/80 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 block">From</span>
                    <span className="font-medium text-slate-900">Airport Residential</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">To</span>
                    <span className="font-medium text-slate-900">Kokomlemle, Accra</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- FEATURES ---------------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-2xl">
          <span className="text-xs font-mono uppercase tracking-widest text-violet-600 font-semibold">Why Waypoint</span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Dispatch built for peace of mind
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Everything you need to move a parcel across the city — with the visibility and payment
            flexibility you'd expect from a modern courier.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="ring-grad group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md shadow-violet-500/20" style={{ background: 'var(--wp-grad)' }}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-mono uppercase tracking-widest text-violet-600 font-semibold">How it works</span>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              From doorstep to destination
            </h2>
          </div>

          {/* Three steps */}
          <div className="mt-12 grid md:grid-cols-3 gap-5">
            {[
              { icon: PackageOpen, step: '01', title: 'Book your parcel', body: 'Enter pickup and dropoff coordinates, pick a size tier, and choose a payment channel.' },
              { icon: Smartphone, step: '02', title: 'We dispatch a rider', body: 'Our team confirms details, assigns a courier, and queues your parcel for pickup.' },
              { icon: Truck, step: '03', title: 'Track to delivery', body: 'Watch every checkpoint update in real time until your parcel is signed and delivered.' },
            ].map((s) => (
              <div key={s.step} className="relative rounded-2xl border border-slate-200 bg-[#F5F8FE] p-6">
                <span className="absolute top-5 right-5 font-mono text-sm font-bold text-slate-300">{s.step}</span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 border border-violet-100 text-violet-600">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          {/* Status pipeline visual */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-[#F5F8FE] p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-semibold text-slate-900">The status pipeline every parcel follows</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-0">
              {PIPELINE.map((p, i) => (
                <div key={p.label} className="flex sm:flex-col items-center sm:flex-1 gap-3 sm:gap-0 sm:text-center">
                  <div className="flex sm:flex-col items-center sm:w-full">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white border border-violet-200 text-violet-600 text-xs font-bold font-mono shadow-sm">
                      {i + 1}
                    </div>
                    {i < PIPELINE.length - 1 && (
                      <div className="hidden sm:block h-px flex-1 w-full mt-0" style={{ background: 'linear-gradient(90deg, rgba(109,94,247,.5), transparent)' }} />
                    )}
                  </div>
                  <div className="sm:mt-3">
                    <span className="block text-sm font-semibold text-slate-900">{p.label}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{p.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- PRICING ---------------- */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-widest text-violet-600 font-semibold">Transparent pricing</span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Flat-rate by parcel size
          </h2>
          <p className="mt-4 text-slate-600">No surprises — you see the exact charge before you confirm a booking.</p>
        </div>

        <div className="mt-12 grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {tiers.map((t, i) => {
            const featured = i === 1;
            const amount = pricing ? (pricing[t.key] / 100).toFixed(2) : null;
            return (
              <div
                key={t.key}
                className={`relative rounded-2xl border p-6 ${
                  featured
                    ? 'border-transparent ring-grad bg-white shadow-xl shadow-violet-200/50'
                    : 'border-slate-200 bg-white shadow-sm'
                }`}
              >
                {featured && (
                  <span className="btn-aurora absolute -top-2.5 left-6 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                    Most popular
                  </span>
                )}
                <span className="text-xs font-mono uppercase tracking-widest text-slate-400">{t.name}</span>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-sm text-slate-400 font-medium">{pricing?.currency ?? 'GHS'}</span>
                  <span className="text-3xl font-semibold font-display text-slate-900 tabular-nums">
                    {amount ?? '—'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700 font-medium">{t.note}</p>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{t.hint}</p>
                <Link
                  to="/book"
                  className={`mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    featured
                      ? 'btn-aurora'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  Book this size
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------- CTA BAND ---------------- */}
      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="relative overflow-hidden rounded-3xl p-10 sm:p-14 text-center text-white" style={{ background: 'var(--wp-grad)' }}>
            <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '22px 22px' }} aria-hidden="true" />
            <div className="relative">
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
                Ready to send your parcel?
              </h2>
              <p className="mt-4 text-white/85 max-w-lg mx-auto">
                Schedule a rider in a couple of minutes. Track it the whole way. Pay when it suits you.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/book"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-violet-700 shadow-lg hover:bg-slate-50 transition-colors"
                >
                  Book a delivery
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/track"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur"
                >
                  Track a shipment
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
