/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MapPin, Phone, Truck, Menu, X, ArrowUpRight } from 'lucide-react';
import { REGIONS } from '../regions.js';
import { CONTACT_PHONE, CONTACT_PHONE_E164, OFFICE_ADDRESS, OFFICE_LANDMARK, SOCIAL, OPENING_HOURS } from '../brand.js';
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
    case 'Snapchat':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2c2.9 0 5 2.2 5 5.1 0 .7-.05 1.4-.08 2 .5.2 1-.15 1.5-.15.55 0 1.1.35 1.1.85 0 .6-.8.9-1.5 1.15-.5.18-.9.3-.9.72 0 .9 2.2 3.6 4.2 4.1.4.1.68.3.68.65 0 .7-1.6 1.05-2.6 1.2-.2.35-.15 1.05-.5 1.2-.3.13-.9-.05-1.6-.05-.9 0-1.5.13-2.1.6-.75.6-1.5 1.2-3.2 1.2s-2.45-.6-3.2-1.2c-.6-.47-1.2-.6-2.1-.6-.7 0-1.3.18-1.6.05-.35-.15-.3-.85-.5-1.2-1-.15-2.6-.5-2.6-1.2 0-.35.28-.55.68-.65 2-.5 4.2-3.2 4.2-4.1 0-.42-.4-.54-.9-.72-.7-.25-1.5-.55-1.5-1.15 0-.5.55-.85 1.1-.85.5 0 1 .35 1.5.15-.03-.6-.08-1.3-.08-2C7 4.2 9.1 2 12 2z" />
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

/**
 * The faint pattern behind the footer.
 *
 * One <defs> of the four shapes this business moves, tiled through a <pattern>
 * so the browser draws them once. Kept at very low opacity: at anything higher
 * it competes with the phone number, which is the only thing down there that
 * matters.
 */
function FooterPattern() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <g id="gd-glyphs" fill="none" stroke="#FF5057" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {/* parcel */}
          <g transform="translate(8 12)">
            <path d="M2 8 14 2l12 6v14l-12 6-12-6z" />
            <path d="M2 8l12 6 12-6M14 14v14" />
          </g>
          {/* delivery van */}
          <g transform="translate(70 20)">
            <path d="M2 6h20v16H2zM22 11h7l5 5v6h-12z" />
            <circle cx="9" cy="24" r="3" />
            <circle cx="27" cy="24" r="3" />
          </g>
          {/* rider on a motorcycle */}
          <g transform="translate(140 16)">
            <circle cx="7" cy="26" r="5" />
            <circle cx="29" cy="26" r="5" />
            <path d="M7 26l7-9h9l6 9M18 5a3 3 0 1 0 0 .1M16 12l5-4 5 3" />
          </g>
          {/* box truck */}
          <g transform="translate(8 78)">
            <path d="M2 4h22v18H2zM24 10h8l5 5v7h-13z" />
            <circle cx="10" cy="24" r="3" />
            <circle cx="30" cy="24" r="3" />
          </g>
          {/* stacked parcels */}
          <g transform="translate(84 84)">
            <rect x="0" y="8" width="14" height="13" rx="1" />
            <rect x="16" y="2" width="14" height="19" rx="1" />
            <path d="M7 8v13M23 2v19" />
          </g>
        </g>

        <pattern id="gd-footer-pattern" width="190" height="130" patternUnits="userSpaceOnUse">
          <use href="#gd-glyphs" opacity="0.16" />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#gd-footer-pattern)" />
    </svg>
  );
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
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Brand. The strapline is gone from the bar — it is in the footer,
              and repeating it here cost vertical space on every page. */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 min-h-11 -ml-1 px-1" aria-label="GO DISPATCH home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white">
              <Truck className="h-4 w-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">GO DISPATCH</span>
          </Link>

          {/* Desktop nav. The active item is marked with a rule under it rather
              than a filled pill — five filled pills in a row read as five
              buttons, none of which is the primary action. */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                aria-current={isActive(l.to) ? 'page' : undefined}
                className={`relative inline-flex items-center min-h-11 px-3 text-[15px] transition-colors ${
                  isActive(l.to)
                    ? 'text-slate-900 after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:rounded-full after:bg-red-600'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* The one action, and the number beside it — a real share of
              customers would rather call than book. */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <a
              href={`tel:${CONTACT_PHONE_E164}`}
              className="inline-flex items-center min-h-11 gap-2 text-[15px] font-medium text-slate-700 hover:text-red-700 transition-colors"
            >
              <Phone className="h-4 w-4 text-red-600" />
              {CONTACT_PHONE}
            </a>
            <Link
              to="/book"
              className="inline-flex items-center min-h-11 gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-4 text-[15px] font-medium text-white transition-colors"
            >
              Book
            </Link>
          </div>

          {/* Phone: call button always visible, menu beside it. Making someone
              open a menu to find the number is the wrong trade for a courier. */}
          <div className="flex md:hidden items-center gap-2">
            <a
              href={`tel:${CONTACT_PHONE_E164}`}
              aria-label={`Call ${CONTACT_PHONE}`}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-600 text-white"
            >
              <Phone className="h-4 w-4" />
            </a>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 transition-colors"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white animate-in slide-in-from-top-2 duration-200">
            <nav className="mx-auto max-w-7xl px-4 py-3">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive(l.to) ? 'page' : undefined}
                  className={`flex items-center justify-between min-h-12 rounded-lg px-3 text-base transition-colors ${
                    isActive(l.to) ? 'text-red-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {l.label}
                  {isActive(l.to) && <span className="h-1.5 w-1.5 rounded-full bg-red-600" aria-hidden="true" />}
                </Link>
              ))}
              <Link
                to="/book"
                onClick={() => setMobileOpen(false)}
                className="mt-2 flex items-center justify-center min-h-12 rounded-lg bg-red-600 text-white text-base font-medium"
              >
                Book a delivery
              </Link>
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
      {/* ---------- Footer ----------
          Cut to roughly half its height: one line of identity, the number, the
          icons and the links, and nothing else. Everything that used to be
          repeated here lives in the nav or on the contact page.

          The background is a black gradient carrying a faint red pattern of
          the things this business actually moves — parcels, a rider, a van, a
          truck. Drawn once and tiled, at low opacity so it reads as texture
          rather than decoration, and marked aria-hidden because it says
          nothing a screen reader needs. */}
      <footer className="mt-auto relative overflow-hidden bg-gradient-to-b from-slate-950 to-black text-white">
        <FooterPattern />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-9">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">

            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 shrink-0">
                <Truck className="h-5 w-5" />
              </span>
              <span className="leading-tight">
                <span className="block text-[15px] font-medium">GO DISPATCH</span>
                <span className="block text-sm text-white/45">We deliver trust</span>
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <a
                href={`tel:${CONTACT_PHONE_E164}`}
                className="inline-flex items-center gap-2 min-h-11 rounded-full bg-red-600 hover:bg-red-500 px-5 text-[15px] font-medium tabular-nums transition-colors"
              >
                <Phone className="h-4 w-4" />
                {CONTACT_PHONE}
              </a>
              {SOCIAL.filter((s) => s.url).map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`GO DISPATCH on ${s.name}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/5 transition-colors"
                >
                  <SocialIcon name={s.name} />
                </a>
              ))}
            </div>
          </div>

          <div className="relative mt-7 pt-6 border-t border-white/10 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-white/40">Opening hours</h3>
              <dl className="mt-2 space-y-1">
                {OPENING_HOURS.map((h) => (
                  <div key={h.days} className="flex items-baseline justify-between gap-4 max-w-xs">
                    <dt className="text-[15px] text-white/70">{h.days}</dt>
                    <dd className={`text-[15px] tabular-nums ${h.hours === 'Closed' ? 'text-white/35' : 'text-white'}`}>
                      {h.hours}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/40">Find us</h3>
              <p className="mt-2 text-[15px] text-white/70">
                {OFFICE_ADDRESS}
                <br />
                <span className="text-white/45">{OFFICE_LANDMARK}</span>
              </p>
              <p className="mt-3 text-[15px] text-white/70">
                A rider collects from anywhere in Accra — you do not need to come in.
              </p>
            </div>
          </div>

          <div className="relative mt-7 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-1 gap-y-0 text-sm text-white/55">
              {[
                { to: '/book', label: 'Book' },
                { to: '/track', label: 'Track' },
                { to: '/contact', label: 'Contact' },
                { to: '/policy', label: 'Terms' },
              ].map((l, i) => (
                <React.Fragment key={l.to}>
                  {i > 0 && <span className="text-white/20" aria-hidden="true">·</span>}
                  <Link to={l.to} className="inline-flex items-center min-h-11 px-2 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </React.Fragment>
              ))}
            </nav>
            <p className="text-sm text-white/35">
              &copy; 2026 GO DISPATCH · Safe · Fast · Reliable
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
