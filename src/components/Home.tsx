/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ArrowRight, Phone, Search, Ban, PackageCheck } from 'lucide-react';
import { Link, useRouter } from '../router.js';
import { PricingConfig } from '../types.js';
import { REGIONS, ALL_TOWNS } from '../regions.js';
import { quote, formatAmount, DEFAULT_PRICING } from '../pricing.js';
import { CONTACT_PHONE, CONTACT_PHONE_E164 } from '../brand.js';
import Reveal from './Reveal.js';
import GhanaMap from './GhanaMap.js';

/**
 * Home.
 *
 * Built around the four things somebody actually wants to know before they
 * trust a courier with a parcel, in the order they ask them:
 *
 *   1. What will it cost?        -> the rate, as the headline
 *   2. Where is the one I sent?  -> tracking, on this page, working
 *   3. Do you go where I need?   -> the road
 *   4. Can I speak to a person?  -> the number, twice
 *
 * What is deliberately NOT here: a mocked-up tracking card beside the
 * headline, a row of four icon-and-two-lines feature cards, and a three-step
 * "how it works". Those are the shapes every generated site arrives in, and
 * not one of them answers a question a customer is actually asking.
 */

/** The status flow a parcel moves through, in customer words. */
const FLOW = ['Booked', 'Confirmed', 'Collected', 'On the road', 'Delivered'];

const WONT_CARRY = [
  'Cash and bank cards',
  'Firearms and ammunition',
  'Illegal or controlled drugs',
  'Live animals',
  'Flammable or corrosive goods',
  'Perishable food, unarranged',
];

export default function Home() {
  const { navigate } = useRouter();
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [code, setCode] = useState('');

  // Falls back to the published rate so the page prices correctly before the
  // API answers, and still reads correctly if it never does.
  const rule = pricing ?? DEFAULT_PRICING;

  useEffect(() => {
    fetch('/api/pricing')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPricing(d))
      .catch(() => {});
  }, []);

  const track = (e: React.FormEvent) => {
    e.preventDefault();
    const q = code.trim();
    if (q) navigate(`/track?code=${encodeURIComponent(q)}`);
  };

  return (
    <div>
      {/* ---------------- HERO ----------------
          Night Run over the map: dark ground, a red glow behind the type the
          way a road looks at night, and the country itself carrying the
          coverage claim. The map is not decoration — every region is a button
          that starts a booking to it. */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {/* The glow. Two sources so the light falls off unevenly, like real
            light rather than a centred radial. */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(58% 62% at 72% 26%, rgba(216,30,36,0.55), transparent 62%), radial-gradient(48% 55% at 18% 82%, rgba(122,15,19,0.55), transparent 66%)',
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="grid lg:grid-cols-[1fr_minmax(0,460px)] gap-12 lg:gap-16 items-center">

            <div>
              <Reveal>
                <span className="text-sm font-semibold uppercase tracking-widest text-red-400">
                  We deliver trust
                </span>
              </Reveal>

              <Reveal delay={70}>
                <h1 className="mt-4 font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95] text-balance">
                  Anywhere in Ghana.
                  <span className="block text-red-400">One rate.</span>
                </h1>
              </Reveal>

              <Reveal delay={130}>
                <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-md leading-relaxed">
                  {formatAmount(rule.baseAmount, rule.currency)} for any parcel up to{' '}
                  {rule.includedKg}kg, collected anywhere in Accra. The distance is our
                  problem, not your bill.
                </p>
              </Reveal>

              <Reveal delay={190}>
                <div className="mt-9 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/book"
                    className="gd-submit inline-flex items-center justify-center gap-2 !w-auto px-8"
                  >
                    Book a delivery
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <a
                    href={`tel:${CONTACT_PHONE_E164}`}
                    className="inline-flex items-center justify-center gap-2.5 rounded-[18px] border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white hover:border-white/40 hover:bg-white/10 transition-colors"
                  >
                    <Phone className="h-5 w-5 text-red-400" />
                    {CONTACT_PHONE}
                  </a>
                </div>
              </Reveal>

              <Reveal delay={250}>
                <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
                  {[
                    ['9', 'regions'],
                    [String(ALL_TOWNS.length), 'towns'],
                    [formatAmount(rule.baseAmount, rule.currency), 'flat rate'],
                  ].map(([value, label]) => (
                    <div key={label}>
                      <dt className="text-sm text-white/50">{label}</dt>
                      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            </div>

            <Reveal delay={160}>
              <GhanaMap onSelect={(region) => navigate(`/book?region=${encodeURIComponent(region)}`)} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- TRACK ----------------
          A working tracking box, high on the page. Checking a parcel is the
          most common reason anyone comes back to a courier's site; making them
          hunt for a nav link is the wrong trade. */}
      <section className="border-b border-slate-200 bg-[var(--wp-bg)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <Reveal>
            <form onSubmit={track} className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <label htmlFor="home_track" className="text-base font-semibold text-slate-900 sm:shrink-0">
                Already sent something?
              </label>
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" aria-hidden="true" />
                <input
                  id="home_track"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="GD-0000-000 or your phone number"
                  className="w-full min-h-14 rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="min-h-14 px-7 rounded-xl bg-slate-900 text-white text-base font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Track it
              </button>
            </form>
          </Reveal>
        </div>
      </section>

      {/* ---------------- THE ROAD ----------------
          Nine regions as stops on one road out of Accra. A list of towns is a
          list; the same towns on a road read as a network. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <Reveal>
          <div className="max-w-2xl">
            <span className="text-sm font-semibold uppercase tracking-widest text-red-600">Where we go</span>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
              One road out of Accra, nine regions along it.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              We collect anywhere in the city. Everything below is the same flat rate.
            </p>
          </div>
        </Reveal>

        <ol className="mt-12 relative">
          <span aria-hidden="true" className="road-line absolute left-[11px] top-2 bottom-2 w-0.5" />

          <li className="relative pl-10 pb-8">
            <span
              aria-hidden="true"
              className="absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 ring-4 ring-[var(--wp-bg)]"
            >
              <span className="h-2 w-2 rounded-full bg-white" />
            </span>
            <Reveal as="left">
              <span className="block text-lg font-bold text-slate-900">Accra</span>
              <span className="block text-base text-slate-500">
                Adabraka, closer to Odorna Clinic — collection from anywhere in the city
              </span>
            </Reveal>
          </li>

          {REGIONS.map((region, i) => (
            <li key={region.name} className="relative pl-10 pb-8 last:pb-0">
              <span
                aria-hidden="true"
                className="absolute left-[5px] top-2 h-3.5 w-3.5 rounded-full border-2 border-red-500 bg-[var(--wp-bg)]"
              />
              <Reveal as="left" delay={i * 55}>
                <span className="block text-lg font-semibold text-slate-900">{region.name}</span>
                <span className="block text-base text-slate-500">{region.towns.join(' · ')}</span>
              </Reveal>
            </li>
          ))}
        </ol>

        <Reveal>
          <p className="mt-8 text-base text-slate-500">
            Somewhere not listed?{' '}
            <a
              href={`tel:${CONTACT_PHONE_E164}`}
              className="inline-flex items-center min-h-11 font-semibold text-red-700 hover:underline"
            >
              Call {CONTACT_PHONE}
            </a>{' '}
            — we go further than the list.
          </p>
        </Reveal>
      </section>

      {/* ---------------- RATE ---------------- */}
      <section id="pricing" className="border-y border-slate-200 bg-white scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            <Reveal>
              <div>
                <span className="text-sm font-semibold uppercase tracking-widest text-red-600">What it costs</span>
                <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
                  Published in full, so you can check it.
                </h2>
                <p className="mt-4 text-lg text-slate-600 max-w-lg">
                  {formatAmount(rule.baseAmount, rule.currency)} covers any parcel up to{' '}
                  {rule.includedKg}kg. Above that, each extra kilo is{' '}
                  {formatAmount(rule.perExtraKgAmount, rule.currency)}, and part kilos round
                  up to the next whole kilo. No distance charge, no surcharge, no asterisk.
                </p>
                <Link
                  to="/book"
                  className="mt-7 inline-flex items-center gap-2 min-h-12 text-base font-bold text-red-700 hover:underline"
                >
                  Get a price for your parcel
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={90}>
              <div className="rounded-2xl border border-slate-200 bg-[var(--wp-bg)] overflow-hidden">
                <table className="w-full text-left">
                  <caption className="sr-only">Delivery price by parcel weight</caption>
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th scope="col" className="px-5 py-3 text-sm font-semibold text-slate-500">Weight</th>
                      <th scope="col" className="px-5 py-3 text-sm font-semibold text-slate-500 text-right">Charge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {[rule.includedKg, 4, 5, 10, 20].map((kg) => (
                      <tr key={kg}>
                        <td className="px-5 py-3.5 text-base text-slate-700">
                          {kg <= rule.includedKg ? `Up to ${rule.includedKg}kg` : `${kg}kg`}
                        </td>
                        <td className="px-5 py-3.5 text-base font-semibold text-slate-900 text-right tabular-nums">
                          {formatAmount(quote(kg, rule).total, rule.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- WHAT WE WON'T CARRY ----------------
          Specific to a courier, and the kind of thing a real operator tells you
          before you pack rather than after they refuse the parcel. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16">
          <Reveal>
            <div>
              <span className="text-sm font-semibold uppercase tracking-widest text-red-600">Before you book</span>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
                Things we will not carry.
              </h2>
              <p className="mt-4 text-lg text-slate-600 max-w-md">
                Better to know now than at the counter. Everything else is fair game — if
                you are unsure, call and ask.
              </p>
              <Link
                to="/policy"
                className="mt-6 inline-flex items-center gap-2 min-h-11 text-base font-bold text-red-700 hover:underline"
              >
                Read the full terms
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            {WONT_CARRY.map((item, i) => (
              <Reveal key={item} delay={i * 50}>
                <div className="flex items-start gap-3 border-t border-slate-200 pt-4">
                  <Ban className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-base text-slate-700">{item}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CLOSE ---------------- */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <Reveal>
            <div className="rounded-2xl bg-slate-900 text-white p-8 sm:p-12 grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
              <div>
                <PackageCheck className="h-7 w-7 text-red-400" aria-hidden="true" />
                <h2 className="mt-4 font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                  Got something that needs to be there?
                </h2>
                <p className="mt-3 text-lg text-white/70 max-w-md">
                  Book it in about two minutes, or call and we will take the details down
                  for you.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Link
                  to="/book"
                  className="flex items-center justify-center min-h-14 rounded-xl bg-red-600 hover:bg-red-500 text-base font-bold transition-colors"
                >
                  Book a delivery
                </Link>
                <a
                  href={`tel:${CONTACT_PHONE_E164}`}
                  className="flex items-center justify-center gap-2.5 min-h-14 rounded-xl border border-white/20 hover:border-white/40 hover:bg-white/5 text-base font-semibold transition-colors"
                >
                  <Phone className="h-5 w-5" />
                  {CONTACT_PHONE}
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
