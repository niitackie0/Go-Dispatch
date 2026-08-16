/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MapPin, Phone, Truck, Menu, X, ArrowUpRight } from 'lucide-react';
import { REGIONS } from '../regions.js';
import { CONTACT_PHONE, CONTACT_PHONE_E164, OFFICE_ADDRESS, OFFICE_LANDMARK, SOCIAL } from '../brand.js';
import { Link, useRouter } from '../router.js';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/book', label: 'Book' },
  { to: '/track', label: 'Track' },
  { to: '/contact', label: 'Contact' },
  { to: '/policy', label: 'Policy' },
];

/** Social glyphs, drawn to one weight so the row reads as a set. */
function SocialIcon({ name }: { name: string }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', 'aria-hidden': true as const };
  switch (name) {
    case 'WhatsApp':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.94.55 3.75 1.5 5.29L2 22l5-1.63a9.8 9.8 0 0 0 5.04 1.38h.01c5.43 0 9.84-4.4 9.84-9.84 0-2.63-1.03-5.1-2.89-6.96A9.77 9.77 0 0 0 12.04 2Zm0 1.8a8 8 0 0 1 5.69 2.36 7.98 7.98 0 0 1 2.36 5.68c0 4.45-3.62 8.05-8.06 8.05a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.06 1 1.02-2.98-.19-.31a7.97 7.97 0 0 1-1.22-4.25c0-4.44 3.62-8.05 8.06-8.05Zm-3.2 4.2c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02 0 1.19.87 2.34 1 2.5.12.16 1.7 2.6 4.13 3.55 2.02.8 2.43.64 2.87.6.44-.04 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.93-1.19-.71-.63-1.19-1.42-1.33-1.66-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.53-1.3-.74-1.78-.19-.46-.39-.4-.53-.4h-.5Z"/>
        </svg>
      );
    case 'Facebook':
      return (
        <svg {...common} fill="currentColor">
          <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.24 10.44 22v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22C18.34 21.24 22 17.08 22 12.06Z"/>
        </svg>
      );
    case 'Instagram':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'TikTok':
      return (
        <svg {...common} fill="currentColor">
          <path d="M16.5 2h-2.9v13.2a2.5 2.5 0 1 1-2.5-2.5c.2 0 .4 0 .6.07V9.8a5.6 5.6 0 1 0 4.9 5.55V8.9a6.4 6.4 0 0 0 3.7 1.18V7.2a3.7 3.7 0 0 1-3.8-3.6V2Z"/>
        </svg>
      );
    default:
      return null;
  }
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { path } = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  /**
   * The header gets out of the way going down and comes back coming up — the
   * standard behaviour on a phone, where a fixed bar costs a tenth of the
   * screen. It never hides while the mobile menu is open, and it never hides
   * near the top of the page, where hiding reads as a glitch.
   */
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  React.useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        setScrolled(y > 8);
        const delta = y - last;
        // Ignore rubber-banding and sub-pixel jitter.
        if (Math.abs(delta) > 6) {
          setHidden(y > 120 && delta > 0);
          last = y;
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // A hidden header must not swallow the menu that opens from it.
  const parked = hidden && !mobileOpen;

  const isActive = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));

  return (
    <div className="min-h-dvh bg-[var(--wp-bg)] text-slate-900 flex flex-col font-sans selection:bg-red-200 selection:text-red-900">
      {/* ---------- Navigation ---------- */}
      <header
        className={`sticky top-0 z-40 w-full bg-white/85 backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-300 ease-out ${
          parked ? '-translate-y-full' : 'translate-y-0'
        } ${scrolled ? 'border-b border-slate-200 shadow-sm' : 'border-b border-transparent'}`}
      >
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
      {/* ---------- Footer ----------
          Sign-off: the strapline set large, the number as a pill, one line of
          links. A closing statement rather than a directory — everything that
          was in the old link columns is either in the nav or on the contact
          page, so repeating it here earned nothing. */}
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16 text-center">

          <p className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
            One rate.
            <span className="block text-red-600">Many places.</span>
          </p>

          <a
            href={`tel:${CONTACT_PHONE_E164}`}
            className="mt-7 inline-flex items-center gap-3 min-h-14 rounded-full bg-red-600 hover:bg-red-700 px-8 text-white text-lg font-bold tabular-nums shadow-[0_16px_22px_-16px_rgba(216,30,36,0.9)] transition-colors"
          >
            <Phone className="h-5 w-5" />
            {CONTACT_PHONE}
          </a>

          {/* Only profiles with a URL are rendered — see SOCIAL in brand.ts. */}
          <ul className="mt-7 flex items-center justify-center gap-3">
            {SOCIAL.filter((s) => s.url).map((s) => (
              <li key={s.name}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`GO DISPATCH on ${s.name}`}
                  title={s.name}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors"
                >
                  <SocialIcon name={s.name} />
                </a>
              </li>
            ))}
          </ul>

          <nav aria-label="Footer" className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-base text-slate-600">
            {[
              { to: '/book', label: 'Book' },
              { to: '/track', label: 'Track' },
              { to: '/contact', label: 'Contact' },
              { to: '/policy', label: 'Terms & policy' },
            ].map((l, i) => (
              <React.Fragment key={l.to}>
                {i > 0 && <span className="text-slate-300" aria-hidden="true">·</span>}
                <Link to={l.to} className="inline-flex items-center min-h-11 px-1 hover:text-red-700 transition-colors">
                  {l.label}
                </Link>
              </React.Fragment>
            ))}
          </nav>

          <p className="mt-6 text-sm text-slate-500">
            {OFFICE_ADDRESS} — {OFFICE_LANDMARK}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            &copy; 2026 GO DISPATCH · We deliver trust · Safe · Fast · Reliable
          </p>
        </div>
      </footer>
    </div>
  );
}
