/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Phone, MessageCircle, MapPin, Clock, PackageSearch } from 'lucide-react';
import { Link } from '../router.js';
import Reveal from './Reveal.js';
import { REGIONS } from '../regions.js';
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
 * Deliberately not a contact form. A form here would be worse than useless:
 * nothing on the server sends or receives email, so a submitted message would
 * go nowhere. Everything on this page is a route that actually works today —
 * the phone, WhatsApp, walking into the office, or the tracking page.
 */
export default function ContactPage() {
  return (
    <div className="animate-in fade-in duration-300">
      {/* The number, immediately. Everything else on this page is secondary. */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <Reveal>
            <span className="text-sm font-semibold uppercase tracking-widest text-red-600">
              Talk to us
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-4 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 text-balance max-w-3xl leading-tight">
              Call us. A real person picks up.
            </h1>
          </Reveal>

          <Reveal delay={140}>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-2xl">
              <a
                href={`tel:${CONTACT_PHONE_E164}`}
                className="flex-1 group flex items-center justify-between gap-4 min-h-16 rounded-2xl bg-red-600 hover:bg-red-700 text-white px-6 shadow-sm transition-colors"
              >
                <span className="flex items-center gap-3">
                  <Phone className="h-6 w-6" />
                  <span className="text-xl sm:text-2xl font-semibold tabular-nums tracking-tight">
                    {CONTACT_PHONE}
                  </span>
                </span>
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-3 min-h-16 rounded-2xl border border-slate-200 bg-white px-6 text-lg font-medium text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </a>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <p className="mt-6 text-lg text-slate-600 max-w-xl">
              Same number for both. Booking a parcel, chasing one, or asking whether we
              reach somewhere — it all goes to the same place.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Three routes, as blocks rather than cards. */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: MapPin,
              title: 'Come to the office',
              body: (
                <>
                  {OFFICE_ADDRESS}
                  <br />
                  <span className="text-slate-500">{OFFICE_LANDMARK}</span>
                </>
              ),
              foot: 'Drop a parcel off in person if it is easier than waiting in.',
            },
            {
              icon: Clock,
              title: 'When we answer',
              body: (
                <>
                  Monday to Saturday
                  <br />
                  <span className="text-slate-500">Hours to be confirmed</span>
                </>
              ),
              foot: 'Outside those hours, WhatsApp us and we will reply when we open.',
            },
            {
              icon: PackageSearch,
              title: 'Already sent something?',
              body: (
                <>
                  Track it yourself
                  <br />
                  <span className="text-slate-500">with your GD- code</span>
                </>
              ),
              foot: 'Faster than calling — every status change shows up there first.',
              to: '/track',
            },
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 90}>
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col">
                <item.icon className="h-6 w-6 text-red-600" />
                <h2 className="mt-4 text-xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-lg text-slate-700 leading-snug">{item.body}</p>
                <p className="mt-auto pt-6 text-base text-slate-500">{item.foot}</p>
                {item.to && (
                  <Link
                    to={item.to}
                    className="mt-4 inline-flex items-center min-h-11 text-base font-semibold text-red-700 hover:underline"
                  >
                    Track a parcel →
                  </Link>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Coverage, restated here because "do you go to X?" is the question we
          are most likely being called about. */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 max-w-2xl text-balance">
              Before you call — this is everywhere we go.
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {REGIONS.map((region, i) => (
              <Reveal key={region.name} delay={i * 40}>
                <div className="border-t border-slate-200 pt-3">
                  <span className="block text-lg font-medium text-slate-900">{region.name}</span>
                  <span className="block text-base text-slate-500">{region.towns.join(', ')}</span>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <p className="mt-10 text-lg text-slate-600 max-w-xl">
              Somewhere not listed? Ask anyway — we go further than the list, and we will
              tell you straight if we cannot.
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
