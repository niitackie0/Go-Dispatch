/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useState } from 'react';
import { REGIONS } from '../regions.js';

/**
 * Ghana, divided into the regions GO DISPATCH serves, with a stop in each.
 *
 * Hand-drawn rather than derived from survey data: the artifact runtime cannot
 * fetch a shapefile, and a stylised map is the right register for a hero
 * anyway. It is recognisably Ghana — the wide north, the narrowing south, the
 * Volta strip down the east, the coast along the bottom — but it is NOT
 * geographically precise, and the boundaries are approximations. Ghana has
 * sixteen regions; the nine drawn here are the ones we deliver to, plus Greater
 * Accra as the origin.
 *
 * Every shape is a button. Choosing one starts a booking to that region, which
 * is the whole reason the map earns its place over a picture.
 */

interface Shape {
  /** Must match a name in src/regions.ts, or be the Accra origin. */
  name: string;
  d: string;
  /** Where the stop sits inside the shape. */
  pin: [number, number];
  /** Where the label sits, and which side it hangs off. */
  label: [number, number];
  anchor?: 'start' | 'middle' | 'end';
}

const ORIGIN: Shape = {
  name: 'Greater Accra',
  d: 'M292 440 L336 458 L300 486 L248 500 Z',
  pin: [296, 466],
  label: [296, 484],
  anchor: 'middle',
};

const SHAPES: Shape[] = [
  { name: 'Upper West', d: 'M54 44 L168 36 L172 112 L52 116 Z',                                pin: [110, 72],  label: [110, 92] },
  { name: 'Upper East', d: 'M168 36 L300 26 L344 64 L352 112 L172 112 Z',                      pin: [258, 68],  label: [258, 88] },
  { name: 'Northern',   d: 'M52 116 L352 112 L356 180 L348 248 L46 252 Z',                     pin: [196, 178], label: [196, 198] },
  { name: 'Bono',       d: 'M46 252 L172 248 L178 364 L54 368 Z',                              pin: [110, 302], label: [110, 322] },
  { name: 'Ashanti',    d: 'M172 248 L268 246 L274 364 L178 364 Z',                            pin: [222, 300], label: [222, 320] },
  { name: 'Eastern',    d: 'M268 246 L344 248 L340 336 L286 368 L274 364 Z',                   pin: [306, 296], label: [306, 316] },
  { name: 'Volta',      d: 'M344 248 L356 300 L352 420 L372 470 L336 458 L292 440 L286 368 L340 336 Z', pin: [332, 372], label: [332, 392] },
  { name: 'Western',    d: 'M54 368 L178 364 L184 470 L150 492 L78 458 L50 392 Z',             pin: [116, 418], label: [116, 438] },
  { name: 'Central',    d: 'M178 364 L274 364 L286 368 L292 440 L248 500 L184 470 Z',          pin: [228, 424], label: [228, 444] },
];

interface GhanaMapProps {
  /** Called with a region name when a stop is chosen. */
  onSelect?: (region: string) => void;
  className?: string;
}

export default function GhanaMap({ onSelect, className = '' }: GhanaMapProps) {
  const glowId = useId();
  const [active, setActive] = useState<string | null>(null);

  const townsFor = (name: string) =>
    REGIONS.find((r) => r.name === name)?.towns.join(' · ') ?? '';

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 420 560"
        className="w-full h-auto"
        role="group"
        aria-label="Map of the regions GO DISPATCH delivers to"
      >
        <defs>
          <radialGradient id={glowId} cx="50%" cy="45%" r="62%">
            <stop offset="0%" stopColor="#FF5057" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#FF5057" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* The glow the whole country sits in. */}
        <ellipse cx="210" cy="260" rx="220" ry="250" fill={`url(#${glowId})`} />

        {/* The routes, drawn from Accra outward. Purely decorative — the shapes
            below carry the meaning and the interaction. */}
        <g stroke="#FF5057" strokeWidth="1.4" strokeDasharray="5 6" opacity="0.45" fill="none">
          {SHAPES.map((s) => (
            <path key={s.name} d={`M${ORIGIN.pin[0]} ${ORIGIN.pin[1]} L${s.pin[0]} ${s.pin[1]}`} />
          ))}
        </g>

        {/* Regions we serve */}
        {SHAPES.map((s) => {
          const on = active === s.name;
          return (
            <g key={s.name}>
              <path
                d={s.d}
                fill={on ? 'rgba(255,80,87,0.30)' : 'rgba(255,255,255,0.05)'}
                stroke={on ? '#FF5057' : 'rgba(255,255,255,0.22)'}
                strokeWidth={on ? 2 : 1.2}
                style={{ transition: 'fill 180ms ease, stroke 180ms ease' }}
              />
              <circle cx={s.pin[0]} cy={s.pin[1]} r={on ? 7 : 5} fill="#FF5057"
                      style={{ transition: 'r 180ms ease' }} />
              <text
                x={s.label[0]}
                y={s.label[1]}
                textAnchor={s.anchor ?? 'middle'}
                className="fill-white"
                style={{ fontSize: 13, fontWeight: 700, pointerEvents: 'none' }}
              >
                {s.name}
              </text>
            </g>
          );
        })}

        {/* Accra — the origin, filled solid so it reads as the start */}
        <g>
          <path d={ORIGIN.d} fill="rgba(255,80,87,0.55)" stroke="#FF5057" strokeWidth="1.6" />
          <circle cx={ORIGIN.pin[0]} cy={ORIGIN.pin[1]} r="7" fill="#fff" />
          <text
            x={ORIGIN.label[0]}
            y={ORIGIN.label[1]}
            textAnchor="start"
            className="fill-white"
            style={{ fontSize: 13, fontWeight: 800, pointerEvents: 'none' }}
          >
            Accra
          </text>
        </g>

        {/* Hit areas last, so they sit above everything and stay tappable. */}
        {SHAPES.map((s) => (
          <path
            key={`${s.name}-hit`}
            d={s.d}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`${s.name} Region — ${townsFor(s.name)}`}
            onMouseEnter={() => setActive(s.name)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(s.name)}
            onBlur={() => setActive(null)}
            onClick={() => onSelect?.(s.name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.(s.name);
              }
            }}
            style={{ cursor: 'pointer', outline: 'none' }}
          />
        ))}
      </svg>

      {/* What the hovered region actually covers. Reserved height so the layout
          does not jump as you move across the map. */}
      <p className="mt-2 min-h-6 text-center text-sm text-white/70" aria-live="polite">
        {active ? (
          <>
            <span className="font-semibold text-white">{active}</span>
            <span className="text-white/50"> — {townsFor(active)}</span>
          </>
        ) : (
          <span className="text-white/40">Tap a region to start a booking</span>
        )}
      </p>
    </div>
  );
}
