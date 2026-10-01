/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Background refresh that only runs while somebody is actually there.
 *
 * The console used to refresh on a bare 30-second interval for as long as the
 * tab existed. A tab left open on an office PC overnight therefore asked the
 * server for the board 2,880 times a day with nobody reading the answer -- and
 * each of those kept the Render instance from sleeping and the Neon compute
 * from scaling to zero, which it only does after five minutes with no queries.
 * That is the same bill the 60-second automation timer ran up in September,
 * arriving from the browser instead of the server.
 *
 * So the refresh now needs two things to be true:
 *
 *  - the tab is visible. A hidden tab is nobody looking.
 *  - somebody has touched the console recently. A visible tab on an unattended
 *    screen is nobody looking either, and it is the commoner case.
 *
 * When either stops being true the interval is cleared outright, not skipped:
 * a paused console asks for nothing at all. Coming back -- the tab shown
 * again, or the first movement, key or touch -- refreshes immediately and
 * resumes, so nobody ever acts on a board older than the moment they returned
 * to it.
 *
 * `paused` is returned so the console can say so, quietly. A board that has
 * stopped updating without saying it has is a board somebody will trust.
 */

interface LiveRefreshOptions {
  /** How often to refresh while live. */
  intervalMs?: number;
  /**
   * How long without a pointer, key or touch before the console counts as
   * unattended. Five minutes, to match the point at which the database would
   * otherwise have been allowed to sleep.
   */
  idleAfterMs?: number;
}

/** Anything that says a person is at the console. All passive, all cheap. */
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const;

export function useLiveRefresh(
  refresh: () => void,
  { intervalMs = 30_000, idleAfterMs = 5 * 60_000 }: LiveRefreshOptions = {}
): { paused: boolean } {
  const [paused, setPaused] = useState(false);

  // The caller's refresh closes over its filters and is a new function every
  // render. Held in a ref so a filter change does not tear the timer and the
  // listeners down and put them back.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastActivityAt = Date.now();

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      setPaused(true);
    };

    const start = () => {
      if (timer !== null) return;
      setPaused(false);
      timer = setInterval(() => {
        if (Date.now() - lastActivityAt >= idleAfterMs) {
          stop();
          return;
        }
        refreshRef.current();
      }, intervalMs);
    };

    /** Somebody is back: show them the board as it is now, then keep it live. */
    const resume = () => {
      if (timer !== null) return;
      refreshRef.current();
      start();
    };

    const onActivity = () => {
      lastActivityAt = Date.now();
      // Hidden tabs do not receive these in practice, but a resume from one
      // would be a refresh nobody can see.
      if (timer === null && document.visibilityState === 'visible') resume();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stop();
        return;
      }
      // Bringing the tab forward is itself somebody arriving.
      lastActivityAt = Date.now();
      resume();
    };

    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisibility);

    // Opened in a background tab: wait to be looked at. The caller's own
    // effects do the first load either way, so there is no refresh here.
    if (document.visibilityState === 'visible') start();
    else setPaused(true);

    return () => {
      if (timer !== null) clearInterval(timer);
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, onActivity);
      }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, idleAfterMs]);

  return { paused };
}
