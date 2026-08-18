/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateModalProps {
  /** yyyy-mm-dd, or empty for no date. */
  value: string;
  onChange: (value: string) => void;
  title: string;
  placeholder?: string;
  id?: string;
  className?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

/** Monday-first weekday index, because that is how a working week is read here. */
const mondayIndex = (date: Date) => (date.getDay() + 6) % 7;

/**
 * A date chooser, as a sheet.
 *
 * The native `<input type="date">` was the last control in the console that
 * behaved like the browser rather than like the rest of the product: a
 * different calendar on every machine, a d/m/y hint nobody reads, and on a
 * phone a wheel that covers what you are filtering. This is the same sheet the
 * status filter uses, so every choice on the screen now opens the same way.
 *
 * The presets matter more than the grid. "Since yesterday" and "last 7 days"
 * are what a dispatcher actually wants; picking a specific date is the rarer
 * case, and it is one tap further in.
 */
export default function DateModal({
  value,
  onChange,
  title,
  placeholder = 'Any time',
  id,
  className = '',
}: DateModalProps) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => (value ? new Date(value) : new Date()));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    setCursor(value ? new Date(value) : new Date());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, value]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const choose = (next: string) => {
    onChange(next);
    close();
  };

  const label = value
    ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : placeholder;

  const presets = [
    { label: 'Any time', value: '' },
    { label: 'Today', value: daysAgo(0) },
    { label: 'Since yesterday', value: daysAgo(1) },
    { label: 'Last 7 days', value: daysAgo(7) },
    { label: 'Last 30 days', value: daysAgo(30) },
  ];

  // The grid for the month on screen, padded so the 1st lands on its weekday.
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(mondayIndex(first)).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = iso(new Date());

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          className ||
          'w-full min-h-12 flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-3.5 text-left text-sm text-slate-900 hover:border-slate-300 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-colors cursor-pointer'
        }
      >
        <Calendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span className={`truncate ${value ? '' : 'text-slate-400'}`}>{label}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={close} aria-hidden="true" />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="relative w-full sm:max-w-sm max-h-[88dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-[0_24px_64px_-16px_rgba(26,17,19,0.35)] outline-none animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => choose(p.value)}
                  className={`min-h-10 rounded-full px-3.5 text-sm font-medium transition-colors cursor-pointer ${
                    value === p.value
                      ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="px-4 pb-5 pt-3">
              <div className="flex items-center justify-between px-1 pb-2">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                  className="h-10 w-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-semibold text-slate-900">
                  {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
                </span>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                  className="h-10 w-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {DAYS.map((d, i) => (
                  <span key={i} className="h-8 flex items-center justify-center text-xs font-medium text-slate-400">
                    {d}
                  </span>
                ))}

                {cells.map((day, i) => {
                  if (day === null) return <span key={`pad-${i}`} />;
                  const cellIso = iso(new Date(cursor.getFullYear(), cursor.getMonth(), day));
                  const selected = cellIso === value;
                  const isToday = cellIso === today;
                  return (
                    <button
                      key={cellIso}
                      type="button"
                      onClick={() => choose(cellIso)}
                      className={`h-10 rounded-xl text-sm tabular-nums transition-colors cursor-pointer ${
                        selected
                          ? 'bg-red-600 font-semibold text-white'
                          : isToday
                            ? 'bg-red-50 font-semibold text-red-700 hover:bg-red-100'
                            : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
