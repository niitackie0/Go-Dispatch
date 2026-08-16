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

/**
 * What we will not carry.
 *
 * Twelve items rather than six, because the short list read as arbitrary — a
 * customer's first thought was "is that all?". Each is drawn: a symbol is read
 * faster than a line of text, and this is a row meant to be scanned.
 *
 * Hand-authored SVG rather than an icon-set lookup. Several of these — a
 * banknote, a firearm, a jerrycan — either are not in the set the rest of the
 * app uses or arrive at a different weight, and a row of a dozen symbols is
 * exactly where a mismatch shows.
 */
const S = {
  width: 30,
  height: 30,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const PROHIBITED: { label: string; icon: React.ReactNode }[] = [
  { label: 'Cash and bank cards', icon: (<svg {...S}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M5 9v6M19 9v6" /></svg>) },
  { label: 'Firearms and ammunition', icon: (<svg {...S}><path d="M3 9h13l3 3h2v3h-6l-2-2H9v4H6v-4H3z" /><path d="M8 15l-2 5" /></svg>) },
  { label: 'Drugs and controlled substances', icon: (<svg {...S}><rect x="2.5" y="9" width="19" height="6.5" rx="3.25" transform="rotate(-30 12 12)" /><path d="M8.6 7.4l6.8 6.8" /></svg>) },
  { label: 'Live animals', icon: (<svg {...S}><ellipse cx="12" cy="15.5" rx="4" ry="3.3" /><ellipse cx="6.4" cy="10.6" rx="1.9" ry="2.5" /><ellipse cx="17.6" cy="10.6" rx="1.9" ry="2.5" /><ellipse cx="9.6" cy="6.6" rx="1.8" ry="2.3" /><ellipse cx="14.4" cy="6.6" rx="1.8" ry="2.3" /></svg>) },
  { label: 'Flammable liquids', icon: (<svg {...S}><path d="M7 8h8l2 3v9a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" /><path d="M10 8V5h4v3" /><path d="M12 13c-1.2 1.2-1.6 2-1.6 2.8a1.6 1.6 0 0 0 3.2 0c0-.8-.4-1.6-1.6-2.8z" /></svg>) },
  { label: 'Perishable food, unarranged', icon: (<svg {...S}><path d="M12 8.5c2.6-2.6 8 0 6.4 5.2C17.3 17.4 14 20 12 20s-5.3-2.6-6.4-6.3C4 8.5 9.4 5.9 12 8.5z" /><path d="M12 8.5V5.5M12 5.5c1.6 0 2.6-1 2.8-2.3-1.5-.2-2.6.7-2.8 2.3z" /></svg>) },
  { label: 'Explosives and fireworks', icon: (<svg {...S}><path d="M12 21a5 5 0 0 0 5-5c0-3-5-9-5-9s-5 6-5 9a5 5 0 0 0 5 5z" /><path d="M12 3v2M6 5l1.4 1.4M18 5l-1.4 1.4" /></svg>) },
  { label: 'Loose lithium batteries', icon: (<svg {...S}><rect x="2" y="8" width="16" height="9" rx="2" /><path d="M18 11h3v3h-3" /><path d="M9 10.5l-2 3h3l-2 3" /></svg>) },
  { label: 'Aerosols and gas canisters', icon: (<svg {...S}><rect x="8" y="8" width="8" height="13" rx="2" /><path d="M10 8V5h4v3" /><path d="M17 5h1M17 8h1M17 11h1" /></svg>) },
  { label: 'Corrosive chemicals', icon: (<svg {...S}><path d="M10 3h4v5l4 9a2 2 0 0 1-1.8 2.9H7.8A2 2 0 0 1 6 17l4-9z" /><path d="M9 15h6" /></svg>) },
  { label: 'Counterfeit goods', icon: (<svg {...S}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.2" /></svg>) },
  { label: 'Unpacked glass or fragile items', icon: (<svg {...S}><path d="M7 3h10l-1.2 7.5a4 4 0 0 1-3.8 3.2h0a4 4 0 0 1-3.8-3.2z" /><path d="M12 13.7V21M9 21h6" /></svg>) },
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
                    className="gd-submit inline-flex items-center justify-center gap-2 !w-auto px-6"
                  >
                    Book a delivery
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href={`tel:${CONTACT_PHONE_E164}`}
                    className="inline-flex items-center justify-center gap-2.5 rounded-[14px] border border-white/20 bg-white/5 px-6 py-3 text-[15px] font-semibold text-white hover:border-white/40 hover:bg-white/10 transition-colors"
                  >
                    <Phone className="h-4 w-4 text-red-400" />
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

      {/* ---------------- WHAT WE WON'T CARRY ----------------
          A drifting row rather than a static grid. Twelve items would be a wall
          as a grid; as one moving line it reads as "there is a list, here is
          the shape of it", and the detail lives in the terms. The track holds
          the list twice so the loop is seamless, it pauses on hover or focus,
          and under reduced motion it becomes a plain scrollable row. */}
      <section className="border-b border-slate-200 bg-white py-12 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="text-sm font-semibold uppercase tracking-widest text-red-600">
                  Before you pack
                </span>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Things we cannot carry.
                </h2>
              </div>
              <Link
                to="/policy"
                className="inline-flex items-center gap-2 min-h-11 text-[15px] font-bold text-red-700 hover:underline"
              >
                Full terms
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>

        <div className="mt-8 marquee" aria-label="Items we cannot carry">
          <ul className="marquee-track">
            {/* Rendered twice: the second copy is what the loop lands on, and is
                hidden from assistive tech so the list is not read out doubled. */}
            {[0, 1].map((copy) =>
              PROHIBITED.map((item) => (
                <li
                  key={`${copy}-${item.label}`}
                  aria-hidden={copy === 1 ? true : undefined}
                  className="shrink-0 w-[168px] rounded-2xl border border-slate-200 bg-[var(--wp-bg)] px-4 py-5 flex flex-col items-center text-center"
                >
                  <span className="relative text-slate-400">
                    {item.icon}
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 h-0.5 w-9 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-red-500/80"
                    />
                  </span>
                  <span className="mt-3 text-[13px] font-semibold text-slate-800 leading-snug">
                    {item.label}
                  </span>
                </li>
              ))
            )}
          </ul>
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
                className="min-h-12 px-6 rounded-xl bg-slate-900 text-white text-[15px] font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Track it
              </button>
            </form>
          </Reveal>
        </div>
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
                  className="flex items-center justify-center min-h-12 rounded-xl bg-red-600 hover:bg-red-500 text-[15px] font-bold transition-colors"
                >
                  Book a delivery
                </Link>
                <a
                  href={`tel:${CONTACT_PHONE_E164}`}
                  className="flex items-center justify-center gap-2.5 min-h-12 rounded-xl border border-white/20 hover:border-white/40 hover:bg-white/5 text-[15px] font-semibold transition-colors"
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
