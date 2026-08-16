/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MapPin, Phone, Truck, Menu, X, ArrowUpRight } from 'lucide-react';
import { REGIONS } from '../regions.js';
import { CONTACT_PHONE, CONTACT_PHONE_E164, OFFICE_ADDRESS, OFFICE_LANDMARK, WHATSAPP_URL } from '../brand.js';
import { Link, useRouter } from '../router.js';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/book', label: 'Book a Delivery' },
  { to: '/track', label: 'Track Shipment' },
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { path } = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));

  return (
    <div className="min-h-dvh bg-[var(--wp-bg)] text-slate-900 flex flex-col font-sans selection:bg-red-200 selection:text-red-900">
      {/* ---------- Navigation ---------- */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="GO DISPATCH home">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg shadow-red-500/25 transition-transform group-hover:scale-105" style={{ background: 'var(--wp-grad)' }}>
              <Truck className="h-5 w-5" />
            </div>
            <div className="leading-none">
              <span className="block text-lg font-bold font-display tracking-tight text-slate-900">GO DISPATCH</span>
              <span className="block text-xs font-mono uppercase tracking-[0.18em] text-slate-400 mt-0.5">We deliver trust</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive(l.to)
                    ? 'text-red-700 bg-red-50'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/book"
              className="btn-aurora inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              Book Now
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 transition-colors"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white animate-in slide-in-from-top-2 duration-200">
            <nav className="mx-auto max-w-7xl px-4 py-4 space-y-1">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    isActive(l.to) ? 'text-red-700 bg-red-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <div className="pt-2">
                <Link
                  to="/book"
                  onClick={() => setMobileOpen(false)}
                  className="btn-aurora block text-center rounded-xl px-4 py-3 text-sm font-semibold"
                >
                  Book Now
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ---------- Page content ---------- */}
      <main className="flex-1">{children}</main>

      {/* ---------- Footer ----------
          Roadline: the route line that runs the length of the page terminates
          here. The two things a customer actually wants at the bottom of a
          courier site are the phone number and where you are, so those are the
          whole first band — not a link column. */}
      <footer className="mt-auto">
        {/* The line arrives, and ends. */}
        <div className="h-px bg-gradient-to-r from-transparent via-red-500 to-transparent" aria-hidden="true" />

        <div className="bg-slate-900 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-14">

            {/* Contact band — the reason most people scroll this far. */}
            <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-end pb-10 border-b border-white/10">
              <div>
                <span className="text-sm font-semibold uppercase tracking-[0.18em] text-red-400">
                  End of the line
                </span>
                <p className="mt-3 font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance max-w-lg">
                  Somewhere to be? We collect anywhere in Accra.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col gap-3">
                <a
                  href={`tel:${CONTACT_PHONE_E164}`}
                  className="group flex items-center justify-between gap-4 min-h-14 rounded-xl bg-red-600 hover:bg-red-500 px-5 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Phone className="h-5 w-5" />
                    <span className="text-lg font-bold tabular-nums">{CONTACT_PHONE}</span>
                  </span>
                  <ArrowUpRight className="h-5 w-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                </a>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 min-h-14 rounded-xl border border-white/20 hover:border-white/40 hover:bg-white/5 px-5 transition-colors"
                >
                  <span className="text-base font-semibold">Message us on WhatsApp</span>
                  <ArrowUpRight className="h-5 w-5 opacity-70" />
                </a>
              </div>
            </div>

            {/* Coverage, stated as regions with the towns underneath, because
                the towns are what the flyer advertises and what people search. */}
            <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] py-10 border-b border-white/10">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/40 mb-4">
                  Nine regions, thirteen towns
                </h4>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                  {REGIONS.map((region) => (
                    <li key={region.name}>
                      <span className="block text-base font-semibold">{region.name}</span>
                      <span className="block text-sm text-white/50">{region.towns.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-1 gap-8">
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/40 mb-3">Find us</h4>
                  <p className="flex items-start gap-2 text-base text-white/80">
                    <MapPin className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <span>{OFFICE_ADDRESS}<br /><span className="text-white/50">{OFFICE_LANDMARK}</span></span>
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/40 mb-3">Site</h4>
                  <ul className="space-y-1">
                    {[
                      { to: '/book', label: 'Book a delivery' },
                      { to: '/track', label: 'Track a parcel' },
                      { to: '/policy', label: 'Terms & policy' },
                    ].map((l) => (
                      <li key={l.to}>
                        <Link
                          to={l.to}
                          className="inline-flex items-center min-h-11 text-base text-white/70 hover:text-white transition-colors"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div className="leading-tight">
                  <span className="block text-base font-bold">GO DISPATCH</span>
                  <span className="block text-sm text-white/40">We deliver trust</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/40">
                <span>Safe</span><span aria-hidden="true">·</span>
                <span>Fast</span><span aria-hidden="true">·</span>
                <span>Reliable</span>
                <span className="w-full sm:w-auto sm:ml-4">&copy; 2026 GO DISPATCH</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
