/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  /** What the control does, in a sentence. Not a repeat of its own label. */
  label: React.ReactNode;
  placement?: Placement;
  /** Long enough that a pointer crossing the screen does not trail bubbles. */
  delay?: number;
  children: React.ReactElement;
}

/**
 * A tooltip for the console.
 *
 * Two decisions worth keeping:
 *
 *  - It renders into <body> at fixed coordinates rather than inside its
 *    trigger. The dispatch board and the payments ledger both live in
 *    `overflow-x-auto` containers, and a container that scrolls in one axis
 *    clips the other — an absolutely positioned bubble above a table button
 *    would be sliced off at the row boundary. Measuring the trigger and
 *    painting the bubble at the top of the document sidesteps that entirely,
 *    and also clears the order drawer's stacking context.
 *  - It answers to focus as well as hover, and closes on Escape. Half this
 *    console is operated from the keyboard by people doing the same twenty
 *    tasks all day; a hint only a mouse can reach is a hint they never get.
 *
 * Because the position is measured once and held, any scroll dismisses it
 * rather than letting the bubble drift away from what it describes.
 */
export default function Tooltip({ label, placement = 'top', delay = 140, children }: TooltipProps) {
  const id = useId();
  const holder = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [box, setBox] = useState<{ top: number; left: number; transform: string } | null>(null);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setBox(null);
  }, []);

  const show = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      // display:contents on the holder means it has no box of its own, so the
      // measurement has to come from the control it wraps.
      const el = (holder.current?.firstElementChild ?? holder.current) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 8;

      const positions: Record<Placement, { top: number; left: number; transform: string }> = {
        top: { top: r.top - gap, left: r.left + r.width / 2, transform: 'translate(-50%, -100%)' },
        bottom: { top: r.bottom + gap, left: r.left + r.width / 2, transform: 'translate(-50%, 0)' },
        left: { top: r.top + r.height / 2, left: r.left - gap, transform: 'translate(-100%, -50%)' },
        right: { top: r.top + r.height / 2, left: r.right + gap, transform: 'translate(0, -50%)' },
      };

      // Flip a top-placed bubble that would land above the viewport, so a
      // tooltip on a sticky header control stays readable.
      const chosen = placement === 'top' && r.top < 56 ? positions.bottom : positions[placement];
      setBox(chosen);
    }, delay);
  }, [delay, placement]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!box) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [box, hide]);

  return (
    <>
      <span
        ref={holder}
        style={{ display: 'contents' }}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocusCapture={show}
        onBlurCapture={hide}
        onPointerDown={hide}
      >
        {React.cloneElement(children, { 'aria-describedby': box ? id : undefined } as any)}
      </span>

      {box &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{ position: 'fixed', top: box.top, left: box.left, transform: box.transform }}
            className="z-[100] pointer-events-none max-w-[260px] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs leading-snug text-white shadow-lg animate-in fade-in duration-100"
          >
            {label}
          </div>,
          document.body
        )}
    </>
  );
}
