/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Phone, MessageCircle, MapPin, Clock, PackageSearch, Bike, ArrowRight } from 'lucide-react';
import { Link } from '../router.js';
import Reveal from './Reveal.js';
import { REGIONS, ALL_TOWNS } from '../regions.js';
import {
  CONTACT_PHONE,
  CONTACT_PHONE_E164,
  OFFICE_ADDRESS,
  OFFICE_LANDMARK,
  WHATSAPP_URL,
} from '../brand.js';

/**
 * Contact.
 *
 * Deliberately not a contact form. Nothing on the server sends or receives
 * email, so a submitted message would go nowhere — every route on this page is
 * one that works today: the phone, WhatsApp, booking a collection, or tracking.
 *
 * The order matters. A courier's contact page is read by two people: someone
 * deciding whether to use you, and someone whose parcel is late. The number
 * answers both, so it comes first and everything else is secondary.
 */
export default function ContactPage() {
  return (
    <div>
      {/* The number, with nothing competing against it. */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
            <div>
              <Reveal>
                <span className="text-sm font-medium uppercase tracking-widest text-red-600">
                  Talk to us
                </span>
              </Reveal>
              <Reveal delay={70}>
                <h1 className="mt-3 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 text-balance">
                  Call us. A real person picks up.
                </h1>
              </Reveal>
              <Reveal delay={130}>
                <p className="mt-4 text-lg text-slate-600 max-w-md">
                  Booking a collection, chasing a parcel, or asking whether we reach
                  somewhere — it all goes to the same number.
                </p>
              </Reveal>
            </div>

            <Reveal delay={160}>
              <div className="flex flex-col gap-3">
                <a
                  href={`tel:${CONTACT_PHONE_E164}`}
                  className="flex items-center justify-between gap-4 min-h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white px-6 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Phone className="h-5 w-5" />
                    <span className="text-lg font-semibold tabular-nums">{CONTACT_PHONE}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 opacity-70" />
                </a>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 min-h-14 rounded-2xl border border-slate-200 bg-white px-6 text-[15px] font-medium text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <MessageCircle className="h-5 w-5 text-red-600" />
                    Message us on WhatsApp
                  </span>
                  <ArrowRight className="h-5 w-5 text-slate-400" />
                </a>
                <p className="text-sm text-slate-500 text-center">Same number for both</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How collection actually works — the thing people most often get wrong
          about us, and half the reason they call. */}
      <section className="border-b border-slate-200 bg-[var(--wp-bg)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          <Reveal>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Bike className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-display text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                You do not need to come to us.
              </h2>
              <p className="mt-3 text-lg text-slate-600 max-w-xl">
                Book a collection and a rider comes to your address anywhere in Accra. We
                weigh each parcel back at the office, and that weighed price is what the
                recipient pays when it arrives.
              </p>
              <Link
                to="/book"
                className="mt-5 inline-flex items-center gap-2 min-h-11 text-[15px] font-medium text-red-700 hover:underline"
              >
                Book a collection
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* The other three routes. */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: PackageSearch,
              title: 'Chasing a parcel?',
              body: 'Track it yourself with the GD- code from your booking.',
              foot: 'Faster than calling — every status change appears there first.',
              to: '/track',
              cta: 'Track a parcel',
            },
            {
              icon: Clock,
              title: 'When we answer',
              body: 'Monday to Saturday.',
              foot: 'Hours to be confirmed. Outside them, WhatsApp us and we reply when we open.',
              to: '',
              cta: '',
            },
            {
              icon: MapPin,
              title: 'Where we are',
              body: `${OFFICE_ADDRESS} — ${OFFICE_LANDMARK}.`,
              foot: 'This is where parcels are weighed. Drop one in yourself if that suits you better.',
              to: '',
              cta: '',
            },
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 80}>
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 flex flex-col">
                <item.icon className="h-5 w-5 text-red-600" />
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1.5 text-[15px] text-slate-700">{item.body}</p>
                <p className="mt-auto pt-5 text-sm text-slate-500">{item.foot}</p>
                {item.to && (
                  <Link
                    to={item.to}
                    className="mt-3 inline-flex items-center gap-2 min-h-11 text-[15px] font-medium text-red-700 hover:underline"
                  >
                    {item.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Coverage, because "do you go to X?" is what we are most often asked. */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                Before you call — everywhere we go.
              </h2>
              <span className="text-sm text-slate-500 tabular-nums">
                {REGIONS.length} regions · {ALL_TOWNS.length} towns
              </span>
            </div>
          </Reveal>

          <div className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {REGIONS.map((region, i) => (
              <Reveal key={region.name} delay={i * 35}>
                <div className="border-t border-slate-200 pt-3">
                  <span className="block text-[15px] font-medium text-slate-900">{region.name}</span>
                  <span className="block text-sm text-slate-500">{region.towns.join(', ')}</span>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={100}>
            <p className="mt-9 text-[15px] text-slate-600 max-w-xl">
              Somewhere not listed? Ask anyway — we go further than the list, and we will
              tell you straight if we cannot.
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
