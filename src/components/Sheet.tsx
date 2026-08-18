/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Pinned to the bottom, outside the scroll — for the one action that matters. */
  footer?: React.ReactNode;
}

/**
 * The console's one way of showing a single thing in detail.
 *
 * It rises from the bottom over the list, which does not move. That is the
 * whole point: the previous attempt grew the row in place, so everything below
 * jumped down the page and you lost the row you were reading. Here the list
 * stays exactly where it was and dims, and closing puts you back with nothing
 * to re-find.
 *
 * The same shape as the status and date pickers, so every "show me more" in
 * the console now behaves identically, and a phone gets a full-height sheet
 * rather than a 512px panel squeezed in from the side.
 */
export default function Sheet({ open, onClose, title, subtitle, children, footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative mx-auto flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-[0_-20px_60px_-16px_rgba(26,17,19,0.4)] outline-none animate-in slide-in-from-bottom-6 duration-250 sm:mb-5 sm:max-w-2xl sm:rounded-3xl"
      >
        {/* The grab handle says "this came from the bottom and goes back there". */}
        <div className="shrink-0 pt-3 pb-1">
          <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-2">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-slate-900">{title}</div>
            {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 rounded-b-none sm:rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
