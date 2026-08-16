/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, Phone } from 'lucide-react';
import Reveal from './Reveal.js';
import { REGIONS } from '../regions.js';
import { DEFAULT_PRICING, formatAmount } from '../pricing.js';
import { CONTACT_PHONE, CONTACT_PHONE_E164, OFFICE_ADDRESS, OFFICE_LANDMARK } from '../brand.js';

/**
 * Terms of service and delivery policy.
 *
 * The figures here are read from the same pricing constants the booking form
 * quotes from, so the published terms cannot drift from what is actually
 * charged.
 *
 * Several clauses need a decision only the business can make — a liability
 * limit, a claims window, how long unclaimed parcels are held. Those are marked
 * in the copy rather than invented, because a term nobody has agreed to is
 * worse than an obvious gap.
 */

const SECTIONS = [
  { id: 'service', label: 'What we do' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'collection', label: 'Collection & delivery' },
  { id: 'prohibited', label: 'What we will not carry' },
  { id: 'liability', label: 'Loss & damage' },
  { id: 'payment', label: 'Payment' },
  { id: 'data', label: 'Your information' },
  { id: 'contact', label: 'Complaints' },
];

function Clause({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <section id={id} className="scroll-mt-28 border-t border-slate-200 pt-6 pb-12">
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-[3rem_1fr]">
          {/* Clauses are numbered because people cite them by number when
              something goes wrong. */}
          <span className="font-mono text-2xl font-semibold text-red-600 tabular-nums leading-none">
            {String(n).padStart(2, '0')}
          </span>
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight text-balance">
              {title}
            </h2>
            <div className="mt-5 space-y-4 text-lg text-slate-700 leading-relaxed max-w-[62ch]">
              {children}
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

/** A term the business still has to set. Visible on purpose. */
function ToConfirm({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
      {children}
    </span>
  );
}

export default function PolicyPage() {
  const rule = DEFAULT_PRICING;

  return (
    <div className="animate-in fade-in duration-300">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Reveal>
            <span className="text-sm font-semibold uppercase tracking-widest text-red-600">
              Terms &amp; policy
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-4 font-display text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight text-balance max-w-3xl leading-tight">
              What you can expect from us, and what we expect from you.
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-6 text-lg text-slate-600 max-w-xl">
              Eight clauses, in plain words. If any of it is unclear, call before you
              book — that is far easier than sorting it out afterwards.
            </p>
          </Reveal>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid lg:grid-cols-[220px_1fr] gap-10">
        {/* On this page */}
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Clauses
          </h2>
          <ul className="space-y-1">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="group flex items-baseline gap-3 min-h-11 text-base text-slate-600 hover:text-red-700 transition-colors"
                >
                  <span className="font-mono text-xs tabular-nums text-slate-400 group-hover:text-red-600">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <div className="border-l-4 border-amber-500 bg-amber-50 px-5 py-4 flex gap-3 mb-10">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-base text-amber-900">
              Highlighted terms still need a decision from GO DISPATCH before this page
              goes to customers. They are shown rather than guessed.
            </p>
          </div>

          <Clause id="service" n={1} title="What we do">
            <p>
              GO DISPATCH is a parcel courier based at {OFFICE_ADDRESS} ({OFFICE_LANDMARK}).
              We collect parcels anywhere in Accra and deliver them to{' '}
              {REGIONS.length} regions across Ghana: {REGIONS.map((r) => r.name).join(', ')}.
            </p>
            <p>
              Booking a delivery on this site is a request. It becomes a contract when we
              confirm it — you will get a tracking code beginning{' '}
              <span className="font-mono font-medium">GD-</span> at that point. We may
              decline a booking, and if we do before collection you pay nothing.
            </p>
          </Clause>

          <Clause id="pricing" n={2} title="Pricing">
            <p>
              Every parcel is weighed at our office after collection, and the weighed
              figure is what is charged. The price quoted at booking is an estimate from
              the weight you declare.
            </p>
            <p>
              One flat rate of{' '}
              <strong>{formatAmount(rule.baseAmount, rule.currency)}</strong> covers any
              parcel up to <strong>{rule.includedKg}kg</strong>, to any region we serve.
              The distance does not change the price.
            </p>
            <p>
              Above {rule.includedKg}kg we charge{' '}
              <strong>{formatAmount(rule.perExtraKgAmount, rule.currency)} per additional
              kilogram</strong>, and part kilos are rounded up to the next whole kilogram.
              A {rule.includedKg + 0.4}kg parcel is billed as {rule.includedKg + 1}kg.
            </p>
            <p>
              The price shown before you confirm is the price you pay. If a parcel turns
              out to weigh more than declared, we will contact you before dispatching it
              rather than charging the difference silently.
            </p>
          </Clause>

          <Clause id="collection" n={3} title="Collection and delivery">
            <p>
              You choose a collection day and time when booking, and a rider comes to your
              address to take the parcel — you do not need to come to our office. We will
              confirm the slot and tell you if we cannot make it. Collection is from an
              address in Accra; we do not currently collect from the destination regions.
            </p>
            <p>
              Delivery times depend on the route and are{' '}
              <ToConfirm>not guaranteed — confirm the target window per region</ToConfirm>.
              You can follow every status change with your tracking code, and the recipient
              is contacted on the number you provide.
            </p>
            <p>
              If nobody is available to receive a parcel, we will hold it and try again. We
              hold unclaimed parcels for{' '}
              <ToConfirm>a period still to be set</ToConfirm>, after which we will contact
              you about return or disposal.
            </p>
          </Clause>

          <Clause id="prohibited" n={4} title="What we will not carry">
            <p>Do not book any of the following. If we find them, we will refuse or return the parcel:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Cash, bank cards, or negotiable instruments</li>
              <li>Firearms, ammunition, explosives or fireworks</li>
              <li>Illegal drugs and controlled substances</li>
              <li>Live animals</li>
              <li>Flammable, corrosive or otherwise hazardous goods</li>
              <li>Perishable food without prior arrangement</li>
              <li>Anything whose carriage or possession is unlawful in Ghana</li>
            </ul>
            <p>
              You are responsible for what you hand us. Declaring a parcel's contents
              accurately at booking is part of the agreement.
            </p>
          </Clause>

          <Clause id="liability" n={5} title="Loss and damage">
            <p>
              We take care of what we carry, and every parcel's status is recorded from
              collection to delivery. If something goes wrong, tell us as soon as you know.
            </p>
            <p>
              Our liability for a lost or damaged parcel is limited to{' '}
              <ToConfirm>an amount still to be set</ToConfirm>, and claims must be raised
              within <ToConfirm>a window still to be set</ToConfirm> of the delivery date.
              Higher-value items should be insured separately — ask us before booking.
            </p>
            <p>
              We are not liable for damage caused by inadequate packaging, for items on the
              prohibited list, or for delays outside our control such as weather, road
              closures or civil disruption.
            </p>
          </Clause>

          <Clause id="payment" n={6} title="Payment">
            <p>
              You can pay by MTN Mobile Money at booking, or in cash when we collect. A
              prepaid booking is not dispatched until the payment has landed; a
              pay-on-collection booking is confirmed straight away and carries a visible
              balance until it is settled.
            </p>
            <p>
              Cancelling before collection costs nothing. Once a parcel has been collected,
              refunds are{' '}
              <ToConfirm>subject to a policy still to be set</ToConfirm>.
            </p>
          </Clause>

          <Clause id="data" n={7} title="Your information">
            <p>
              We keep the sender's and recipient's names, phone numbers and addresses, along
              with the parcel details and its status history. We use them to run the
              delivery, to contact you about it, and to keep our own records.
            </p>
            <p>
              We do not sell your information. We share it only with the rider carrying your
              parcel, and where the law requires it. Ask us and we will tell you what we hold
              about you.
            </p>
          </Clause>

          <Clause id="contact" n={8} title="Complaints">
            <p>
              Call or message us first — most problems are a phone call. Have your{' '}
              <span className="font-mono font-medium">GD-</span> tracking code ready.
            </p>
            <a
              href={`tel:${CONTACT_PHONE_E164}`}
              className="inline-flex items-center gap-3 min-h-14 rounded-xl bg-red-600 hover:bg-red-500 text-white px-5 font-semibold text-lg tabular-nums transition-colors"
            >
              <Phone className="h-5 w-5" />
              {CONTACT_PHONE}
            </a>
            <p className="text-sm text-slate-500">
              {OFFICE_ADDRESS} — {OFFICE_LANDMARK}
            </p>
          </Clause>
        </div>
      </div>
    </div>
  );
}
