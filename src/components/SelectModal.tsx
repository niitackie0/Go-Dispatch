/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  /** Second line, for anything that needs explaining. */
  hint?: string;
  disabled?: boolean;
}

interface SelectModalProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Heading inside the sheet. */
  title: string;
  /** Shown on the trigger when nothing is chosen. */
  placeholder?: string;
  subtitle?: string;
  id?: string;
  disabled?: boolean;
  /** Extra classes for the trigger, for callers that need a specific look. */
  className?: string;
}

/**
 * A chooser, as a sheet rather than a native select.
 *
 * The same pattern as the region and time pickers, generalised so every choice
 * on the site behaves identically: full-screen on a phone, centred from sm up,
 * closes on Escape and on a backdrop click, returns focus to the trigger, and
 * locks background scroll while open.
 *
 * Options carry an optional hint line, which a native `<option>` cannot show —
 * that is most of the reason for replacing it, beyond the cramped wheel a
 * native select becomes on a phone.
 */
export default function SelectModal({
  value,
  options,
  onChange,
  title,
  placeholder = 'Choose…',
  subtitle,
  id,
  disabled = false,
  className = '',
}: SelectModalProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
  const choose = (v: string) => { onChange(v); close(); };

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          className ||
          'w-full min-h-11 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-900 hover:border-slate-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
        }
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-slate-900/50" onClick={close} aria-hidden="true" />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="relative w-full sm:max-w-md max-h-[85dvh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl outline-none animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
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
              {options.map((o) => {
                const active = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      disabled={o.disabled}
                      onClick={() => choose(o.value)}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full min-h-14 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        active ? 'bg-red-50 border border-red-200' : 'border border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className={`block text-[15px] font-medium ${active ? 'text-red-700' : 'text-slate-900'}`}>
                          {o.label}
                        </span>
                        {o.hint && <span className="block text-sm text-slate-500">{o.hint}</span>}
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
