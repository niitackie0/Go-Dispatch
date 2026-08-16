/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, X } from 'lucide-react';

interface WhenPickerProps {
  /** datetime-local string, e.g. 2026-08-17T09:00 */
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

/** The hours a rider can realistically be sent out. */
const SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The next fourteen days, starting today. */
function upcomingDays(): { key: string; weekday: string; day: string; month: string; label: string }[] {
  const out = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      key: dayKey(d),
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
      day: String(d.getDate()),
      month: d.toLocaleDateString(undefined, { month: 'short' }),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
    });
  }
  return out;
}

/**
 * Collection time, as a sheet rather than a native datetime input.
 *
 * A native datetime-local is a different control on every platform, allows any
 * minute of any day including ones we do not run, and on some Android builds
 * is close to unusable. This offers the days we can actually come and the
 * hours we actually work, which is both easier to tap and impossible to get
 * wrong.
 *
 * Same behaviour as the region picker: closes on Escape and backdrop, returns
 * focus to the trigger, locks background scroll.
 */
export default function WhenPicker({ value, onChange, id }: WhenPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const days = upcomingDays();
  const [selectedDay, setSelectedDay] = useState(() => value.slice(0, 10) || days[1].key);
  const selectedTime = value.slice(11, 16);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  const choose = (time: string) => { onChange(`${selectedDay}T${time}`); close(); };

  const summary = value
    ? (() => {
        const d = days.find((x) => x.key === value.slice(0, 10));
        const when = d ? d.label : new Date(value).toLocaleDateString();
        return `${when}, ${value.slice(11, 16)}`;
      })()
    : '';

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
          <CalendarDays className={`h-5 w-5 shrink-0 ${value ? 'text-red-600' : 'text-slate-400'}`} />
          <span className="min-w-0">
            {value ? (
              <>
                <span className="block text-[15px] font-medium text-slate-900">{summary}</span>
                <span className="block text-sm text-slate-500">A rider comes to you</span>
              </>
            ) : (
              <span className="block text-[15px] text-slate-500">Choose a day and time…</span>
            )}
          </span>
        </span>
        <span className="text-sm font-medium text-red-700 shrink-0">{value ? 'Change' : 'Select'}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-slate-900/50" onClick={close} aria-hidden="true" />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Choose a collection day and time"
            tabIndex={-1}
            className="relative w-full sm:max-w-lg max-h-[85dvh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl outline-none animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">When should we come?</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  A rider will collect from your address in Accra.
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

            <div className="overflow-y-auto">
              {/* Days run across, so a fortnight fits without a calendar grid. */}
              <div className="px-5 pt-4">
                <span className="text-sm font-medium text-slate-500">Day</span>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {days.map((d) => {
                    const on = d.key === selectedDay;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setSelectedDay(d.key)}
                        aria-pressed={on}
                        className={`shrink-0 w-16 min-h-16 rounded-xl border flex flex-col items-center justify-center transition-colors cursor-pointer ${
                          on ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-xs">{d.weekday}</span>
                        <span className="text-lg font-semibold leading-none mt-0.5">{d.day}</span>
                        <span className="text-xs text-slate-400">{d.month}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-5 pb-5 pt-2">
                <span className="text-sm font-medium text-slate-500">Time</span>
                <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {SLOTS.map((slot) => {
                    const on = slot === selectedTime && selectedDay === value.slice(0, 10);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => choose(slot)}
                        className={`min-h-12 rounded-xl border text-[15px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                          on ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {slot}
                        {on && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-sm text-slate-500">
                  We collect Monday to Saturday. Pick the closest hour — the rider will
                  call before setting off.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
