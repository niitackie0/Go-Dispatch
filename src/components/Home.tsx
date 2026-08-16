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
import { REGIONS, ALL_TOWNS } from '../regions.js';
import { quote, formatAmount, DEFAULT_PRICING } from '../pricing.js';
import { CONTACT_PHONE, CONTACT_PHONE_E164 } from '../brand.js';
import Reveal from './Reveal.js';

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
    title: 'One rate, whatever the distance',
    body: 'GHS 50 covers any parcel up to 3kg, to any region we serve. Heavier loads are charged by the kilo, published up front.',
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
    title: 'Nationwide coverage',
    body: 'Kumasi, Tamale, Takoradi, Cape Coast and ten more towns across nine regions — collected from anywhere in Accra.',
  },
];

export default function Home() {
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  // Falls back to the published rate so the page prices correctly before the
  // API answers, and still renders if it never does.
  const rule = pricing ?? DEFAULT_PRICING;

  useEffect(() => {
    fetch('/api/pricing')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPricing(d))
      .catch(() => {});
  }, []);


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
                One flat rate · nine regions
              </div>

              <h1 className="mt-6 font-display text-4xl sm:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]">
                Send anything,
                <br />
                <span className="text-gradient">track everything.</span>
              </h1>

              <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-lg">
                We collect anywhere in Accra and deliver to nine regions across Ghana. One flat rate,
                whatever the distance. Follow every checkpoint with a tracking code.
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
                    <span className="text-xl font-semibold font-mono text-slate-900">GD-8293-102</span>
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
                    <span className="font-medium text-slate-900">Adabraka, Accra</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">To</span>
                    <span className="font-medium text-slate-900">Tamale</span>
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
          <span className="text-xs font-mono uppercase tracking-widest text-red-600 font-semibold">Why GO DISPATCH</span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Dispatch built for peace of mind
          </h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Everything you need to send a parcel across Ghana — with the visibility and payment
            flexibility you'd expect from a modern courier.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="ring-grad group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md shadow-red-500/20" style={{ background: 'var(--wp-grad)' }}>
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
            <span className="text-xs font-mono uppercase tracking-widest text-red-600 font-semibold">How it works</span>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              From doorstep to destination
            </h2>
          </div>

          {/* Three steps */}
          <div className="mt-12 grid md:grid-cols-3 gap-5">
            {[
              { icon: PackageOpen, step: '01', title: 'Book your parcel', body: 'Give us the Accra pickup address, choose the destination region, and tell us the weight.' },
              { icon: Smartphone, step: '02', title: 'We dispatch a rider', body: 'Our team confirms details, assigns a courier, and queues your parcel for pickup.' },
              { icon: Truck, step: '03', title: 'Track to delivery', body: 'Watch every checkpoint update in real time until your parcel is signed and delivered.' },
            ].map((s) => (
              <div key={s.step} className="relative rounded-2xl border border-slate-200 bg-[var(--wp-bg)] p-6">
                <span className="absolute top-5 right-5 font-mono text-sm font-bold text-slate-300">{s.step}</span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 border border-red-100 text-red-600">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          {/* Status pipeline visual */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-[var(--wp-bg)] p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="h-4 w-4 text-red-600" />
              <span className="text-sm font-semibold text-slate-900">The status pipeline every parcel follows</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-0">
              {PIPELINE.map((p, i) => (
                <div key={p.label} className="flex sm:flex-col items-center sm:flex-1 gap-3 sm:gap-0 sm:text-center">
                  <div className="flex sm:flex-col items-center sm:w-full">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white border border-red-200 text-red-600 text-xs font-bold font-mono shadow-sm">
                      {i + 1}
                    </div>
                    {i < PIPELINE.length - 1 && (
                      <div className="hidden sm:block h-px flex-1 w-full mt-0" style={{ background: 'linear-gradient(90deg, rgba(216,30,36,.5), transparent)' }} />
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

      {/* ---------------- THE ROAD ----------------
          Roadline's signature move. Thirteen towns in a list is a list; the
          same towns as stops on one road is a network, and the second reads
          as a bigger company. The line is drawn, not decorative: each stop is
          a region we actually serve, in the order you would meet them leaving
          Accra. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <Reveal>
        <div className="max-w-2xl">
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-red-600">Where we go</span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
            One road out of Accra, nine regions along it.
          </h2>
          <p className="mt-4 text-slate-600">
            We collect anywhere in Accra. Everything below is the same flat rate — the
            distance is our problem, not your bill.
          </p>
        </div>
        </Reveal>

        <ol className="mt-12 relative">
          {/* The road itself, travelling. */}
          <span
            aria-hidden="true"
            className="road-line absolute left-[11px] top-2 bottom-2 w-0.5"
          />

          <li className="relative pl-10 pb-8">
            <span aria-hidden="true" className="absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 ring-4 ring-[var(--wp-bg)]">
              <span className="h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="block text-lg font-bold text-slate-900">Accra</span>
            <span className="block text-base text-slate-500">
              Adabraka, closer to Odorna Clinic — we collect from anywhere in the city
            </span>
          </li>

          {REGIONS.map((region, i) => (
            <li key={region.name} className="relative pl-10 pb-8 last:pb-0">
              <span
                aria-hidden="true"
                className="absolute left-[5px] top-2 h-3.5 w-3.5 rounded-full border-2 border-red-500 bg-[var(--wp-bg)]"
              />
              <Reveal as="left" delay={i * 60}>
                <span className="block text-lg font-semibold text-slate-900">{region.name}</span>
                <span className="block text-base text-slate-500">{region.towns.join(' · ')}</span>
              </Reveal>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-base text-slate-500">
          Not on the road yet? Call <a href={`tel:${CONTACT_PHONE_E164}`} className="inline-flex items-center min-h-11 font-semibold text-red-700 hover:underline">{CONTACT_PHONE}</a> and ask — we go further than the list.
        </p>
      </section>

      {/* ---------------- PRICING ---------------- */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-widest text-red-600">Transparent pricing</span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            One rate. Many places.
          </h2>
          <p className="mt-4 text-slate-600">
            The same price to every town we serve. You see the exact charge before you confirm.
          </p>
        </div>

        <div className="mt-12 max-w-4xl mx-auto grid md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-transparent ring-grad bg-white p-8 shadow-xl shadow-red-200/40 text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-slate-400">Flat rate</span>
            <div className="mt-3 flex items-baseline justify-center gap-2">
              <span className="text-base text-slate-400 font-medium">{rule.currency}</span>
              <span className="text-6xl font-bold font-display text-red-600 tabular-nums leading-none">
                {(rule.baseAmount / 100).toFixed(0)}
              </span>
            </div>
            <p className="mt-3 text-base text-slate-700 font-medium">
              Any parcel up to {rule.includedKg}kg, to any of our {REGIONS.length} regions
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Heavier than that? Each extra kilo is {formatAmount(rule.perExtraKgAmount, rule.currency)}.
            </p>
            <Link
              to="/book"
              className="btn-aurora mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-base font-semibold"
            >
              Book a delivery
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Worked examples, so the weight charge is not a surprise at the counter. */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <h3 className="text-base font-semibold text-slate-900">What it costs</h3>
            <ul className="mt-4 divide-y divide-slate-100">
              {[1, 3, 5, 10].map((kg) => (
                <li key={kg} className="flex items-center justify-between py-3">
                  <span className="text-base text-slate-600">{kg}kg parcel</span>
                  <span className="text-base font-semibold text-slate-900 tabular-nums">
                    {formatAmount(quote(kg, rule).total, rule.currency)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-500">
              Part kilos round up to the next whole kilo.
            </p>
          </div>
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
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-red-700 shadow-lg hover:bg-slate-50 transition-colors"
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
