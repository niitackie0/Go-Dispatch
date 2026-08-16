/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Check, MapPin, X } from 'lucide-react';
import { REGIONS } from '../regions.js';

interface RegionPickerProps {
  value: string;
  onChange: (region: string) => void;
  id?: string;
}

/**
 * Region chooser, as a full-screen sheet rather than a native select.
 *
 * A native `<select>` on a phone is a cramped wheel that shows a few items at a
 * time and cannot show which towns a region covers. That matters here: three of
 * the advertised towns share Central Region, so the towns are the only way a
 * customer knows their destination is served at all.
 *
 * The sheet closes on Escape and on a backdrop click, returns focus to the
 * trigger, and locks background scroll while open.
 */
export default function RegionPicker({ value, onChange, id }: RegionPickerProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);

    // Stop the page behind the sheet from scrolling with it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the sheet so a keyboard or screen reader lands there.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const choose = (region: string) => {
    onChange(region);
    close();
  };

  const selected = REGIONS.find((r) => r.name === value);

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-full min-h-14 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-slate-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-3 min-w-0">
          <MapPin className={`h-5 w-5 shrink-0 ${value ? 'text-red-600' : 'text-slate-400'}`} />
          <span className="min-w-0">
            {value ? (
              <>
                <span className="block text-base font-semibold text-slate-900">{value} Region</span>
                <span className="block text-sm text-slate-500 truncate">{selected?.towns.join(' · ')}</span>
              </>
            ) : (
              <span className="block text-base text-slate-500">Choose a region…</span>
            )}
          </span>
        </span>
        <span className="text-sm font-semibold text-red-700 shrink-0">{value ? 'Change' : 'Select'}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={close}
            aria-hidden="true"
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Choose a delivery region"
            tabIndex={-1}
            className="relative w-full sm:max-w-lg max-h-[85dvh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl outline-none animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Where is it going?</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  We collect anywhere in Accra and deliver to these regions.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ul className="overflow-y-auto p-2">
              {REGIONS.map((region) => {
                const active = region.name === value;
                return (
                  <li key={region.name}>
                    <button
                      type="button"
                      onClick={() => choose(region.name)}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full min-h-16 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors cursor-pointer ${
                        active ? 'bg-red-50 border border-red-200' : 'border border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className={`block text-base font-semibold ${active ? 'text-red-700' : 'text-slate-900'}`}>
                          {region.name}
                        </span>
                        {/* The towns are what the flyer advertises, so they are
                            how a customer recognises their destination. */}
                        <span className="block text-sm text-slate-500">{region.towns.join(' · ')}</span>
                      </span>
                      {active && <Check className="h-5 w-5 text-red-600 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
