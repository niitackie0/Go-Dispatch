/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ArrowRight, Phone, Search, PackageCheck } from 'lucide-react';
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

/**
 * A figure inside a sentence.
 *
 * Nothing but a weight and colour change — the number keeps its place in the
 * prose, so the sentence still reads normally out loud, but the figures can be
 * found without reading it. tabular-nums so a changing price does not shuffle
 * the words around it.
 */
function Num({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span className={`font-semibold tabular-nums ${dark ? 'text-white' : 'text-slate-900'}`}>
      {children}
    </span>
  );
}

/** The status flow a parcel moves through, in customer words. */
const FLOW = ['Booked', 'Rider collects', 'Weighed', 'On the road', 'Delivered'];

/**
 * What we will not carry.
 *
 * Two lists, because there are two rules and running them together was the
 * flaw in the old row: ten things a rider will hand straight back, and two
 * that only need telling us first. The split is what a customer actually
 * needs to know, and it matches clause 4 of the terms exactly.
 *
 * Each item is drawn as a prohibition sign rather than an icon with a stripe
 * over it. The stripe was the problem — a short bar floating across a glyph
 * reads as a rendering artefact. The sign is the one every road in Ghana
 * already uses: red ring, red bar corner to corner, pictogram in the middle.
 * It carries its meaning without the heading, which is the whole point of a
 * symbol.
 */

/** A pictogram in the 24-unit box the glyphs below are drawn in. */
const G = {
  fill: 'none',
  stroke: 'currentColor',
  // Heavier than the icons elsewhere on the site: a hairline pictogram loses
  // to the bar drawn across it, which is what made the old row unreadable.
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/**
 * The sign.
 *
 * The bar does not cross the pictogram. That was the flaw in both earlier
 * attempts: a stripe over line art bisects every stroke it meets, and the eye
 * cannot complete a drawing made of 2px lines the way it completes a solid
 * silhouette on a road sign. So the pictogram gets the whole plate and the
 * negation gets its own badge — a solid red disc with a white bar, ringed in
 * white so it separates from whatever it sits over.
 *
 * Both halves are legible at 64px, which is the point. Drawn as one SVG so
 * the plate, the pictogram and the badge cannot drift apart.
 *
 * `forbidden={false}` drops the badge. Those two items are allowed, and
 * marking them as though they were not would be a lie told in symbols.
 */
function Sign({ children, forbidden = true }: { children: React.ReactNode; forbidden?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={forbidden ? 'h-16 w-16 sm:h-[72px] sm:w-[72px] shrink-0' : 'h-14 w-14 shrink-0'}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="29" cy="29" r="29" fill={forbidden ? '#FDECEC' : '#EEF2F6'} />
      {/* The pictogram is drawn in a 24-unit box; this maps it to 34 units,
          centred on the plate. */}
      <g
        transform="translate(12 12) scale(1.4167)"
        className={forbidden ? 'text-slate-800' : 'text-slate-600'}
        {...G}
      >
        {children}
      </g>
      {forbidden && (
        <>
          <circle cx="51" cy="51" r="12.6" fill="#FFFFFF" />
          <circle cx="51" cy="51" r="10.2" fill="#D81E24" />
          <line x1="46.6" y1="55.4" x2="55.4" y2="46.6" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/** Refused outright. Ten, and the grid is 2 or 5 across so it never breaks
    into a ragged last row. */
const NEVER: { label: string; icon: React.ReactNode }[] = [
  {
    label: 'Cash and bank cards',
    icon: (<><rect x="2" y="7" width="20" height="10" rx="1.6" /><circle cx="12" cy="12" r="2.4" /><path d="M5.2 10v4M18.8 10v4" /></>),
  },
  {
    label: 'Firearms and ammunition',
    icon: (<><path d="M12 2.6c1.9 2 3 4.1 3 6.1V10H9V8.7c0-2 1.1-4.1 3-6.1z" /><path d="M9 10h6v7.6H9z" /><path d="M8.3 17.6h7.4v3.8H8.3z" /></>),
  },
  {
    label: 'Drugs and controlled substances',
    icon: (<><rect x="1.6" y="8.4" width="20.8" height="7.2" rx="3.6" transform="rotate(-45 12 12)" /><path d="M9.5 9.5 14.5 14.5" /></>),
  },
  {
    label: 'Explosives and fireworks',
    icon: (<><circle cx="10.4" cy="14.8" r="6.2" /><path d="M14.8 10.4 17 8.2" /><path d="M17 8.2c0-2.2 1.7-3.9 3.9-3.9" /><path d="M20.9 2.9V1.6M22.2 4.1l.9-.9" /></>),
  },
  {
    label: 'Flammable liquids',
    icon: (<><path d="M12 2.6c3.4 3.6 5.8 6.4 5.8 9.9a5.8 5.8 0 1 1-11.6 0c0-2 .9-3.7 2.2-5.2" /><path d="M12 21.6a3 3 0 0 0 3-3c0-2-3-5-3-5s-3 3-3 5a3 3 0 0 0 3 3z" /></>),
  },
  {
    label: 'Corrosive chemicals',
    icon: (<><path d="M9.6 2.8h4.8v5.6l4.5 8.8A2.3 2.3 0 0 1 16.8 21H7.2a2.3 2.3 0 0 1-2.1-3.8l4.5-8.8z" /><path d="M7.4 15.4h9.2" /></>),
  },
  {
    label: 'Aerosols and gas canisters',
    icon: (<><rect x="7.2" y="8" width="7.2" height="13" rx="2.2" /><path d="M9.2 8V5.1h3.2V8" /><path d="M16.8 5.4h1.6M16.8 8.6h1.6M16.8 11.8h1.6" /></>),
  },
  {
    label: 'Loose lithium batteries',
    icon: (<><rect x="2.2" y="7.4" width="15.4" height="9.2" rx="2.2" /><path d="M17.6 10.4h2.4a1 1 0 0 1 1 1v1.2a1 1 0 0 1-1 1h-2.4" /><path d="M10.6 9.4 8 12.8h3.4l-2.6 3.4" /></>),
  },
  {
    label: 'Counterfeit goods',
    icon: (<><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><path d="M7.5 7.5h.01" /></>),
  },
  {
    label: 'Live animals',
    icon: (<><ellipse cx="12" cy="16" rx="4.1" ry="3.4" /><ellipse cx="6.2" cy="11" rx="1.9" ry="2.5" /><ellipse cx="17.8" cy="11" rx="1.9" ry="2.5" /><ellipse cx="9.5" cy="6.6" rx="1.8" ry="2.4" /><ellipse cx="14.5" cy="6.6" rx="1.8" ry="2.4" /></>),
  },
];

/** Not refused — just not a surprise on the doorstep. */
const ASK_FIRST: { label: string; note: string; icon: React.ReactNode }[] = [
  {
    label: 'Perishable food',
    note: 'Say so when you book, so it goes out on the first run rather than sitting.',
    icon: (<><path d="M12 8.6c2.6-2.6 8 0 6.4 5.2C17.3 17.5 14 20.2 12 20.2s-5.3-2.7-6.4-6.4C4 8.6 9.4 6 12 8.6z" /><path d="M12 8.6V5.4" /><path d="M12 5.4c1.7 0 2.7-1 2.9-2.4-1.6-.2-2.7.7-2.9 2.4z" /></>),
  },
  {
    label: 'Glass and fragile things',
    note: 'Tell the rider at collection and pack it properly — unwrapped glass travels badly.',
    icon: (<><path d="M6.8 3h10.4l-1.3 7.8a4.2 4.2 0 0 1-4 3.4h-.2a4.2 4.2 0 0 1-4-3.4z" /><path d="M12 14.2V21M8.8 21h6.4" /><path d="M12.8 3.8 11.1 7l2.3 1.4-1.6 2.9" /></>),
  },
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
                <span className="text-sm font-medium uppercase tracking-widest text-red-400">
                  We deliver trust
                </span>
              </Reveal>

              <Reveal delay={70}>
                <h1 className="mt-4 font-display text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[0.95] text-balance">
                  Anywhere in Ghana.
                  <span className="block text-red-400">One rate.</span>
                </h1>
              </Reveal>

              <Reveal delay={130}>
                <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-md leading-relaxed">
                  <Num dark>{formatAmount(rule.baseAmount, rule.currency)}</Num> for any
                  parcel up to <Num dark>{rule.includedKg}kg</Num>, collected anywhere in
                  Accra. The distance is our problem, not your bill.
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
                    className="inline-flex items-center justify-center gap-2.5 rounded-[14px] border border-white/20 bg-white/5 px-6 py-3 text-[15px] font-medium text-white hover:border-white/40 hover:bg-white/10 transition-colors"
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
                      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
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
          Was a marquee. A moving row is the wrong container for a list
          somebody has to check their own parcel against: you cannot scan it,
          you cannot find one item in it, and at 46 seconds a loop the thing
          you came to look for may be forty seconds away. It is a grid now,
          all of it visible at once, in the order the terms list it.

          Two groups, because there are two rules — and the shorter group is
          the one people get caught by, so it is stated rather than buried. */}
      <section className="border-b border-slate-200 bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="max-w-xl">
                <span className="text-sm font-medium uppercase tracking-widest text-red-600">
                  Before you pack
                </span>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                  <Num>{NEVER.length}</Num> things a rider will hand back.
                </h2>
                <p className="mt-3 text-lg text-slate-600">
                  Book any of these and the parcel comes home with you. Two more just
                  need telling us first.
                </p>
              </div>
              <Link
                to="/policy"
                className="inline-flex items-center gap-2 min-h-11 text-[15px] font-medium text-red-700 hover:underline"
              >
                Full terms
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          {/* Hairlines rather than twelve separate cards: one list, not ten
              objects. The gap-px trick draws them at every breakpoint, and 2
              and 5 both divide ten, so no row is ever left half-empty. */}
          <Reveal delay={80}>
            <ul className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200">
              {NEVER.map((item) => (
                <li
                  key={item.label}
                  className="flex flex-col items-center gap-3 bg-white px-3 py-7 text-center"
                >
                  <Sign>{item.icon}</Sign>
                  <span className="text-[15px] text-slate-700 leading-snug text-balance">
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Different rule, different shape. No ring and no bar on these two
              — they are allowed, and a slash would say otherwise. */}
          <Reveal delay={120}>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-[var(--wp-bg)] p-5 sm:p-6">
              <h3 className="text-sm font-medium uppercase tracking-widest text-slate-500">
                These two are fine — just tell us first
              </h3>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {ASK_FIRST.map((item) => (
                  <div key={item.label} className="flex items-start gap-4">
                    <Sign forbidden={false}>{item.icon}</Sign>
                    <div className="min-w-0">
                      <span className="block text-[15px] font-medium text-slate-900">{item.label}</span>
                      <span className="mt-1 block text-[15px] text-slate-600">{item.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
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
              <label htmlFor="home_track" className="text-base font-medium text-slate-900 sm:shrink-0">
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
                className="min-h-12 px-6 rounded-xl bg-slate-900 text-white text-[15px] font-medium hover:bg-slate-800 transition-colors cursor-pointer"
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
                <span className="text-sm font-medium uppercase tracking-widest text-red-600">What it costs</span>
                <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight text-balance">
                  Published in full, so you can check it.
                </h2>
                <p className="mt-4 text-lg text-slate-600 max-w-lg leading-relaxed">
                  <Num>{formatAmount(rule.baseAmount, rule.currency)}</Num> covers any parcel
                  up to <Num>{rule.includedKg}kg</Num>. Above that, each extra kilo is{' '}
                  <Num>{formatAmount(rule.perExtraKgAmount, rule.currency)}</Num>, and part
                  kilos round up to the next whole kilo. No distance charge, no surcharge,
                  no asterisk.
                </p>
                <Link
                  to="/book"
                  className="mt-7 inline-flex items-center gap-2 min-h-12 text-base font-semibold text-red-700 hover:underline"
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
                      <th scope="col" className="px-5 py-3 text-sm font-medium text-slate-500">Weight</th>
                      <th scope="col" className="px-5 py-3 text-sm font-medium text-slate-500 text-right">Charge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {[rule.includedKg, 4, 5, 10, 20].map((kg) => (
                      <tr key={kg}>
                        <td className="px-5 py-3.5 text-base text-slate-700">
                          {kg <= rule.includedKg ? `Up to ${rule.includedKg}kg` : `${kg}kg`}
                        </td>
                        <td className="px-5 py-3.5 text-base font-medium text-slate-900 text-right tabular-nums">
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
                <h2 className="mt-4 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
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
                  className="flex items-center justify-center min-h-12 rounded-xl bg-red-600 hover:bg-red-500 text-[15px] font-semibold transition-colors"
                >
                  Book a delivery
                </Link>
                <a
                  href={`tel:${CONTACT_PHONE_E164}`}
                  className="flex items-center justify-center gap-2.5 min-h-12 rounded-xl border border-white/20 hover:border-white/40 hover:bg-white/5 text-[15px] font-medium transition-colors"
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
