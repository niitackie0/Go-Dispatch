/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  /** Milliseconds to hold before this element animates. Use to stagger a group. */
  delay?: number;
  /** How it arrives. `line` grows a rule; `up` is the default rise. */
  as?: 'up' | 'left' | 'line';
  className?: string;
}

/**
 * Scroll-triggered reveal.
 *
 * Motion here is doing a job, not decorating: the page is a road, and content
 * arrives as you travel down it. Anything that would merely wobble on screen
 * was left alone.
 *
 * Three rules it follows, all of which are easy to get wrong:
 *
 *  - It animates transform and opacity only, so it never triggers layout.
 *  - It reveals ONCE and then unobserves. Content that re-animates every time
 *    it re-enters the viewport is the single most irritating scroll effect.
 *  - Under `prefers-reduced-motion` it renders visible immediately and never
 *    observes anything. The content is never gated behind an animation, which
 *    matters because a failed observer would otherwise leave a blank page.
 */
export default function Reveal({ children, delay = 0, as = 'up', className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Honour the OS setting, and bail out to visible if the browser is too old
    // for IntersectionObserver rather than hiding content forever.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.unobserve(entry.target);
      },
      // Fire a little before the element is fully on screen, so it has arrived
      // by the time the reader's eye reaches it.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={as}
      data-shown={shown ? 'true' : 'false'}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={className}
    >
      {children}
    </div>
  );
}
