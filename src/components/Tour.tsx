/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * A guided tour: the page dims, one thing on it is lit, and a card beside it
 * says what it is for.
 *
 * Used twice — once on the customer site for somebody who has never booked
 * with us, once in the console for a member of staff on their first day. Both
 * are the same problem: the page is fine once you know it, and nobody was ever
 * told. Written here rather than pulled in as a library because it is two
 * hundred lines against a dependency several times the size of the customer
 * bundle's own code.
 *
 * It points at things that are really on the page, by selector, rather than
 * showing pictures of them. A step whose target is not on screen — the desktop
 * Book button on a phone, a console section this role cannot see — is passed
 * over instead of pointing at nothing, which is why a target may list several
 * selectors: the first one that is actually visible wins.
 *
 * Whether somebody has seen it is remembered in localStorage and nowhere else.
 * That is per browser, not per person, and it is the right size of memory for
 * the job: the worst case is being offered the tour twice.
 */

export interface TourStep {
  /**
   * What to light up. A CSS selector, or several separated by commas; the
   * first visible match is used. Leave it out for a card in the middle of the
   * screen — a welcome, or a closing word.
   */
  target?: string;
  title: string;
  body: string;
  /** Run before the step is shown, e.g. to switch the console to a section. */
  before?: () => void;
}

interface TourProps {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  /** The label on the last step's button. */
  doneLabel?: string;
  /**
   * Called when the last step's button is pressed, just before onClose. Not
   * called for Skip, Close or Escape — so the button can lead somewhere
   * without every other way out of the tour leading there too.
   */
  onDone?: () => void;
  /**
   * Height of anything stuck to the top of the window, in pixels. A target is
   * never scrolled up underneath it.
   */
  topInset?: number;
}

/** Has this browser been shown the tour stored under `key`? */
export function tourSeen(key: string): boolean {
  // Storage throws in some private windows. Treat that as "seen": a tour that
  // opens on every single visit is worse than one that never opens by itself.
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return true;
  }
}

export function markTourSeen(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    /* nothing to do — see tourSeen */
  }
}

/** The first element matching `selector` that is actually drawn. */
function findVisible(selector: string): HTMLElement | null {
  let found: NodeListOf<HTMLElement>;
  try {
    found = document.querySelectorAll<HTMLElement>(selector);
  } catch {
    return null;
  }
  for (const el of found) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
  }
  return null;
}

interface Box { top: number; left: number; width: number; height: number }

const PAD = 8;
const GAP = 14;
const EDGE = 12;

export default function Tour({ steps, open, onClose, doneLabel = 'Done', onDone, topInset = 0 }: TourProps) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  // Which way the visitor was travelling, so a step with nothing to point at
  // is skipped in that direction rather than always forwards.
  const direction = useRef<1 | -1>(1);

  const step = steps[index];
  const last = index === steps.length - 1;

  // Rewound on closing as well as on opening. If it were only done on opening,
  // the tour would reopen for one render still on the step it was left at, and
  // run that step's `before` — switching the console to some section — before
  // going back to the start.
  useEffect(() => {
    setIndex(0);
    direction.current = 1;
  }, [open]);

  // Reads `index` rather than using a state updater: closing is the parent's
  // state, and an updater must not reach outside its own (React runs them
  // twice in development, and may run them while rendering).
  const go = useCallback((delta: 1 | -1) => {
    direction.current = delta;
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) {
      onDone?.();
      onClose();
    } else setIndex(next);
  }, [index, steps.length, onClose, onDone]);

  /** Read the target's place on screen. Called often; cheap. */
  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el || !el.isConnected) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setBox((prev) =>
      prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
        ? prev
        : { top: r.top, left: r.left, width: r.width, height: r.height }
    );
  }, []);

  // Lights out on closing, so the next opening does not begin by lighting
  // whatever the last one ended on.
  useEffect(() => {
    if (open) return;
    targetRef.current = null;
    setBox(null);
  }, [open]);

  // Arriving at a step: prepare the page, find the target, bring it into view.
  useEffect(() => {
    if (!open || !step) return;
    step.before?.();

    if (!step.target) {
      targetRef.current = null;
      setBox(null);
      return;
    }
    // The last target stays lit until the new one is found, so the light
    // travels from one to the other instead of going out in between.

    // One frame for `before` to land — a console section has to render before
    // anything in it can be found.
    const timer = window.setTimeout(() => {
      const el = findVisible(step.target!);
      if (!el) {
        // Nothing to point at here. Move on the way we were going; at either
        // end, stay put and show the card on its own.
        const next = index + direction.current;
        if (next >= 0 && next < steps.length) setIndex(next);
        else {
          targetRef.current = null;
          setBox(null);
        }
        return;
      }
      targetRef.current = el;
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Where the target should come to rest. Not the middle of the screen:
      // on a phone that leaves room for the card neither above nor below, and
      // the card ends up sitting on the thing it is describing. Target and
      // card are centred as a pair; if the pair is taller than the screen the
      // target goes to the top and the card takes what is left.
      const h = el.getBoundingClientRect().height;
      const ch = cardRef.current?.offsetHeight ?? 0;
      const pair = h + PAD * 2 + GAP + ch;
      const room = window.innerHeight - topInset - EDGE * 2;
      const top = topInset + EDGE + PAD + Math.max(0, (room - pair) / 2);

      // scrollIntoView rather than window.scrollTo, so a target inside a
      // scrolling panel is still reached. A scroll margin is how it is told
      // where to stop; the destination is fixed when the call is made, so the
      // margin can be put back straight away.
      const margin = el.style.scrollMarginTop;
      el.style.scrollMarginTop = `${top}px`;
      el.scrollIntoView({ block: 'start', inline: 'nearest', behavior: calm ? 'auto' : 'smooth' });
      el.style.scrollMarginTop = margin;
      measure();
    }, 80);

    return () => window.clearTimeout(timer);
    // `step` is derived from index; listing it would re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  // Keep the light on the target while the page moves under it: smooth
  // scrolling, a header sliding away, a late image. Polled as well as
  // listened for, because none of those reliably fire an event.
  useEffect(() => {
    if (!open) return;
    const poll = window.setInterval(measure, 150);
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('scroll', measure, { capture: true });
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  // Where the card goes: under the target if there is room, over it if not,
  // and in the middle of the screen when there is no target at all.
  useLayoutEffect(() => {
    if (!open) return;
    const card = cardRef.current;
    if (!card) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;

    if (!box) {
      setCardPos({ top: Math.max(EDGE, (vh - ch) / 2), left: Math.max(EDGE, (vw - cw) / 2) });
      return;
    }

    const below = box.top + box.height + PAD + GAP;
    const above = box.top - PAD - GAP - ch;
    let top: number;
    if (below + ch <= vh - EDGE) top = below;
    else if (above >= EDGE) top = above;
    // Neither fits — a target taller than the screen. Sit at the bottom, over
    // it, which still leaves most of it showing.
    else top = vh - ch - EDGE;

    const left = Math.min(Math.max(EDGE, box.left + box.width / 2 - cw / 2), vw - cw - EDGE);
    setCardPos({ top: Math.max(EDGE, top), left });
  }, [open, box, index]);

  // `placed` is a dependency because a card that is still hidden cannot take
  // focus: the first time the tour opens, this runs before the card has been
  // positioned, and has to run again once it has.
  const placed = cardPos !== null;
  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, index, go, onClose, placed]);

  if (!open || !step) return null;

  return (
    <div className="fixed inset-0 z-[100]" id="gd_tour">
      {/* Catches every click, so nothing on the page can be pressed by
          accident mid-tour. Dims the page itself only when there is no
          spotlight to do it. */}
      <div className={`absolute inset-0 ${box ? '' : 'bg-slate-950/60'}`} aria-hidden="true" />

      {/* The spotlight: a clear window whose enormous shadow is the dimming. */}
      {box && (
        <div
          aria-hidden="true"
          className="gd-tour-spot pointer-events-none fixed rounded-2xl"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.62), 0 0 0 2px rgba(255, 255, 255, 0.9)',
          }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gd_tour_title"
        aria-describedby="gd_tour_body"
        tabIndex={-1}
        className="gd-tour-card fixed w-[min(22.5rem,calc(100vw-1.5rem))] rounded-2xl bg-white p-5 text-left shadow-2xl outline-none"
        style={{
          top: cardPos?.top ?? 0,
          left: cardPos?.left ?? 0,
          // Not shown until it has been measured and placed, or it flashes in
          // the corner for a frame first.
          visibility: cardPos ? 'visible' : 'hidden',
        }}
      >
        <p className="text-sm font-medium text-red-600 tabular-nums">
          {index + 1} of {steps.length}
        </p>
        <h2 id="gd_tour_title" className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
          {step.title}
        </h2>
        <p id="gd_tour_body" className="mt-2 text-base text-slate-600">
          {step.body}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 -ml-2 rounded-xl px-2 text-sm text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            {last ? 'Close' : 'Skip the tour'}
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => go(-1)}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => go(1)}
              className="min-h-11 rounded-xl bg-red-600 px-5 text-sm font-medium text-white hover:bg-red-700 transition-colors cursor-pointer"
            >
              {last ? doneLabel : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
