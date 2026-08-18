/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Pinned outside the scroll — for the one action that matters. */
  footer?: React.ReactNode;
}

/**
 * The console's one way of showing a single thing in detail.
 *
 * It takes two shapes, because a phone and a 1080p monitor are not the same
 * problem wearing different widths.
 *
 * ON A PHONE it rises from the bottom, full width. Detail arrives from the
 * direction the thumb is, the list underneath does not move, and closing puts
 * you back with nothing to re-find. The grab handle is the convention that
 * says which way it came from and which way it goes back.
 *
 * ON A DESKTOP it arrives from the right and stands full height beside the
 * board, which stays visible and in place. This is the correction to what was
 * here before: a bottom sheet stretched onto a wide screen becomes a tall
 * column parked over the middle of the work, covering the very list you are
 * moving through — and it kept a grab handle promising a drag that no mouse
 * can perform. Dispatch is a two-panel job. Scan the board, open one parcel,
 * act, go to the next; the board should never leave the screen to do it.
 *
 * The scrim, the escape key, the locked background scroll and the close button
 * are common to both, so there is still only one thing to learn.
 */
export default function Sheet({ open, onClose, title, subtitle, children, footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

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
    // Bottom-aligned on a phone, right-aligned from sm up. One element, two
    // anchors — the panel below simply fills whichever it is given.
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:flex-row sm:justify-end">
      {/* On a phone the sheet covers most of the screen, so the scrim is doing
          real work: it hides a list you cannot see anyway and says the page
          behind is not currently yours.

          On a desktop it would undo the entire point of a side sheet. The
          board is deliberately still on screen so you keep your place in it —
          dimming and blurring it into illegibility leaves you with the cost of
          showing it and none of the benefit. So it thins to a wash: enough to
          push the board back a layer, not enough to stop you reading it. It
          still fills the viewport, so clicking away still closes. */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-200 sm:bg-slate-900/10 sm:backdrop-blur-none"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="
          relative flex w-full flex-col bg-white outline-none
          max-h-[92dvh] rounded-t-3xl
          shadow-[0_-20px_60px_-16px_rgba(26,17,19,0.4)]
          animate-in slide-in-from-bottom-6 duration-250
          sm:h-full sm:max-h-none sm:w-[min(34rem,100vw)]
          sm:rounded-none sm:rounded-l-3xl
          sm:shadow-[-24px_0_60px_-24px_rgba(26,17,19,0.4)]
          sm:slide-in-from-bottom-0 sm:slide-in-from-right-8
        "
      >
        {/* Only meaningful where a thumb can act on it. */}
        <div className="shrink-0 pt-3 pb-1 sm:hidden">
          <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-2 sm:pt-5">
          <div className="min-w-0">
            <div id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </div>
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
          <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
