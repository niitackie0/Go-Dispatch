/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MapPin, Phone, Truck, Menu, X, ArrowUpRight } from 'lucide-react';
import { DESTINATIONS } from '../destinations.js';
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

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--wp-grad)' }}>
                  <Truck className="h-4.5 w-4.5" />
                </div>
                <span className="text-base font-bold font-display text-slate-900">GO DISPATCH</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-red-700">We deliver trust</p>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed max-w-xs">
                Doorstep delivery from Accra to thirteen towns nationwide. One rate,
                many places — we go the distance for you.
              </p>
              <a
                href={`tel:${CONTACT_PHONE_E164}`}
                className="mt-4 inline-flex items-center gap-2 min-h-11 text-base font-bold text-slate-900 hover:text-red-700 transition-colors"
              >
                <Phone className="h-4 w-4 text-red-600" />
                {CONTACT_PHONE}
              </a>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Services</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link to="/book" className="inline-flex items-center min-h-11 hover:text-red-700 transition-colors">Book a delivery</Link></li>
                <li><Link to="/track" className="inline-flex items-center min-h-11 hover:text-red-700 transition-colors">Track a shipment</Link></li>
                <li><Link to="/#pricing" className="inline-flex items-center min-h-11 hover:text-red-700 transition-colors">Our rate</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">We deliver to</h4>
              <ul className="space-y-1 text-sm text-slate-500 columns-2 md:columns-1">
                {DESTINATIONS.map((town) => (
                  <li key={town}>{town}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Find us</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{OFFICE_ADDRESS}<br />{OFFICE_LANDMARK}</span>
                </li>
                <li>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center min-h-11 hover:text-red-700 transition-colors"
                  >
                    Call or WhatsApp us
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <span className="font-medium text-slate-500">GO DISPATCH &copy; 2026. All rights reserved.</span>
            <span>Safe · Fast · Reliable</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
