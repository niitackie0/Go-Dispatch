/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Phone } from 'lucide-react';
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
 *
 * LAYOUT — a ledger that folds.
 *
 * Each clause is a two-column row: its name on the left, its text on the right,
 * the way contracts and specifications have been set for a century. Closed, the
 * right column holds a one-line gist instead, so the whole agreement is a
 * single screen that reads as its own table of contents — and a reader opens
 * only the clause they came for.
 *
 * Built on <details>, so it works before JavaScript runs, find-in-page can open
 * a closed clause, and there is no open/closed state of our own to keep. The
 * summary is the entire row, so the tap target is the full width.
 *
 * On a phone the two columns stack, which is the same page with one column.
 */

/** The shared column rhythm. Named once so the summary and the body cannot drift apart. */
const COLUMNS = 'grid gap-x-10 lg:grid-cols-[minmax(0,200px)_minmax(0,1fr)]';

/**
 * One clause: name and number on the left, text on the right, folded shut.
 *
 * `gist` is what stands in for the clause while it is closed — not a teaser,
 * but an honest summary, so somebody who reads only the closed page still knows
 * what they agreed to.
 */
function Clause({
  id,
  n,
  title,
  gist,
  children,
}: {
  id: string;
  n: number;
  title: string;
  gist: string;
  children: React.ReactNode;
}) {
  return (
    <details id={id} className="group scroll-mt-24 border-b border-slate-200">
      <summary
        className="
          list-none [&::-webkit-details-marker]:hidden cursor-pointer
          -mx-4 px-4 py-5 rounded-lg
          hover:bg-slate-50/80 transition-colors
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600
        "
      >
        <div className={COLUMNS}>
          <h2 className="flex items-baseline gap-3 text-base font-medium text-slate-900 tracking-tight">
            <span className="font-mono text-xs tabular-nums text-red-600">
              {String(n).padStart(2, '0')}
            </span>
            {title}
          </h2>

          <div className="flex items-start justify-between gap-6 mt-1.5 lg:mt-0">
            {/* The gist steps aside once the real clause is on screen. */}
            <p className="text-base text-slate-500 group-open:hidden max-w-[62ch]">{gist}</p>

            {/* A plus that loses its upright stroke when the clause opens.
                Quieter than a chevron, and it says the same thing. */}
            <span
              aria-hidden="true"
              className="relative mt-2.5 h-2.5 w-2.5 shrink-0 text-slate-400"
            >
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current origin-center transition-transform duration-200 group-open:scale-y-0" />
            </span>
          </div>
        </div>
      </summary>

      <div className={`${COLUMNS} pb-8`}>
        <div aria-hidden="true" />
        <div className="space-y-4 text-base leading-relaxed text-slate-700 max-w-[62ch]">
          {children}
        </div>
      </div>
    </details>
  );
}

/**
 * A term the business still has to set.
 *
 * A dotted rule under the words rather than a highlighter block: it has to stay
 * visible to whoever signs this page off, without making the agreement look
 * like it was marked up in a hurry.
 */
function ToConfirm({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-slate-900 underline decoration-dotted decoration-red-400 underline-offset-4">
      {children}
    </span>
  );
}

export default function PolicyPage() {
  const rule = DEFAULT_PRICING;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <header className="pt-16 pb-10 sm:pt-24 sm:pb-14">
          <Reveal>
            <span className="font-mono text-xs uppercase tracking-widest text-red-600">
              Terms &amp; policy
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-5 font-display text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight text-balance max-w-2xl leading-[1.15]">
              What you can expect from us, and what we expect from you.
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-5 text-lg text-slate-600 max-w-[58ch]">
              Eight clauses, in plain words. Open the one you need. If any of it is
              unclear, call before you book — that is far easier than sorting it out
              afterwards.
            </p>
          </Reveal>
        </header>

        <div className="pb-24">
          <div className="border-t border-slate-200">
            <Clause
              id="service"
              n={1}
              title="What we do"
              gist={`We collect anywhere in Accra and deliver to ${REGIONS.length} regions.`}
            >
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

            <Clause
              id="pricing"
              n={2}
              title="Pricing"
              gist={`${formatAmount(rule.baseAmount, rule.currency)} up to ${rule.includedKg}kg, anywhere we go. We weigh it at the office.`}
            >
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

            <Clause
              id="collection"
              n={3}
              title="Collection and delivery"
              gist="A rider comes to your address. You pick the day and time."
            >
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

            <Clause
              id="prohibited"
              n={4}
              title="What we will not carry"
              gist="No cash, weapons, drugs, live animals or hazardous goods."
            >
              <p>Do not book any of the following. If we find them, we will refuse or return the parcel:</p>
              <ul className="list-disc pl-5 space-y-1.5 marker:text-slate-300">
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

            <Clause
              id="liability"
              n={5}
              title="Loss and damage"
              gist="Tell us as soon as you know. Limits and the claims window are still to be set."
            >
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

            <Clause
              id="payment"
              n={6}
              title="Payment"
              gist="MTN Mobile Money at booking, or cash when we collect."
            >
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

            <Clause
              id="data"
              n={7}
              title="Your information"
              gist="Names, numbers and addresses, used to run the delivery. We do not sell them."
            >
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

            <Clause
              id="contact"
              n={8}
              title="Complaints"
              gist={`Call ${CONTACT_PHONE} with your GD- code. Most problems are a phone call.`}
            >
              <p>
                Call or message us first — most problems are a phone call. Have your{' '}
                <span className="font-mono font-medium">GD-</span> tracking code ready.
              </p>
              <a
                href={`tel:${CONTACT_PHONE_E164}`}
                className="inline-flex items-center gap-3 min-h-13 rounded-xl bg-red-600 hover:bg-red-500 text-white px-5 font-semibold text-lg tabular-nums transition-colors"
              >
                <Phone className="h-5 w-5" />
                {CONTACT_PHONE}
              </a>
              <p className="text-sm text-slate-500">
                {OFFICE_ADDRESS} — {OFFICE_LANDMARK}
              </p>
            </Clause>
          </div>

          {/* Kept deliberately plain, and last: it is a note to ourselves that
              happens to be honest with customers, not a warning banner. */}
          <p className="mt-8 text-sm text-slate-500 max-w-[62ch]">
            The{' '}
            <span className="text-slate-700 underline decoration-dotted decoration-red-400 underline-offset-4">
              underlined terms
            </span>{' '}
            still need a decision from GO DISPATCH before this page goes to customers. They
            are shown rather than guessed. Last updated {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.
          </p>
        </div>
      </div>
    </div>
  );
}
