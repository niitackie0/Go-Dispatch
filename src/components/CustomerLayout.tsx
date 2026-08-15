/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Truck, Menu, X, ArrowUpRight } from 'lucide-react';
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
    <div className="min-h-dvh bg-[#F5F8FE] text-slate-900 flex flex-col font-sans selection:bg-violet-200 selection:text-violet-900">
      {/* ---------- Navigation ---------- */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="Waypoint home">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg shadow-violet-500/25 transition-transform group-hover:scale-105" style={{ background: 'var(--wp-grad)' }}>
              <Truck className="h-5 w-5" />
            </div>
            <div className="leading-none">
              <span className="block text-lg font-bold font-display tracking-tight text-slate-900">Waypoint</span>
              <span className="block text-[10px] font-mono uppercase tracking-[0.18em] text-slate-400 mt-0.5">Parcel &amp; Dispatch</span>
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
                    ? 'text-violet-700 bg-violet-50'
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
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 transition-colors"
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
                    isActive(l.to) ? 'text-violet-700 bg-violet-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
                <span className="text-base font-bold font-display text-slate-900">Waypoint</span>
              </div>
              <p className="mt-4 text-sm text-slate-500 leading-relaxed max-w-xs">
                A premium parcel delivery network for Accra, Tema &amp; Kumasi. Book a rider, trace every step, pay your way.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Services</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link to="/book" className="hover:text-violet-700 transition-colors">Book a delivery</Link></li>
                <li><Link to="/track" className="hover:text-violet-700 transition-colors">Track a shipment</Link></li>
                <li><Link to="/#pricing" className="hover:text-violet-700 transition-colors">Pricing tiers</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Coverage</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li>Accra Metropolitan</li>
                <li>Tema &amp; Community areas</li>
                <li>Kumasi Metropolitan</li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link to="/track" className="hover:text-violet-700 transition-colors">Track a shipment</Link></li>
                <li>Accra, Ghana</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <span className="font-medium text-slate-500">Waypoint Courier Services Ltd. &copy; 2026. All rights reserved.</span>
            <span className="font-mono">Made in Accra 🇬🇭</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
