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

/** The national outline, so the country reads as Ghana even where the internal
 *  boundaries are approximate. */
const OUTLINE = 'M57.2 37.8 L154.5 33.4 L229.7 28.9 L269.2 25.4 L324.6 37.8 L352.3 64.6 L309.6 171.7 L328.6 243.1 L320.7 305.5 L352.3 359.1 L376 439.4 L376 475.1 L328.6 501.8 L281.1 524.2 L209.9 528.6 L154.5 573.2 L114.9 582.2 L59.6 577.7 L35.8 564.3 L23.2 484 L51.6 394.8 L75.4 305.5 L63.5 216.3 Z';

const ORIGIN: Shape = {
  name: 'Greater Accra',
  d: 'M257.4 434.9 L289 434.9 L308.8 479.5 L281.1 524.2 L237.6 524.2 Z',
  pin: [266.1, 519.7],
  label: [280.1, 523.7],
  anchor: 'start',
};

const SHAPES: Shape[] = [
  { name: 'Upper West', d: 'M57.2 37.8 L154.5 33.4 L154.5 162.8 L63.5 162.8 L63.5 216.3 L57.2 37.8 Z', pin: [83.3, 121.7], label: [83.3, 138.7] },
  { name: 'Upper East', d: 'M154.5 33.4 L269.2 25.4 L324.6 37.8 L309.6 100.3 L154.5 100.3 Z', pin: [213.8, 56.6], label: [213.8, 73.6] },
  { name: 'Northern', d: 'M154.5 100.3 L309.6 100.3 L324.6 37.8 L352.3 64.6 L309.6 171.7 L328.6 243.1 L79.3 243.1 L63.5 162.8 L154.5 162.8 Z', pin: [214.6, 180.6], label: [214.6, 197.6] },
  { name: 'Bono', d: 'M79.3 243.1 L194.1 243.1 L194.1 385.8 L65.9 385.8 L75.4 305.5 Z', pin: [96.7, 364.4], label: [96.7, 381.4] },
  { name: 'Ashanti', d: 'M194.1 243.1 L253.4 243.1 L257.4 434.9 L190.1 466.2 L194.1 385.8 Z', pin: [152.9, 422.4], label: [152.9, 439.4] },
  { name: 'Eastern', d: 'M253.4 243.1 L324.6 274.3 L320.7 305.5 L330.2 376.9 L289 434.9 L257.4 434.9 Z', pin: [260.5, 476], label: [260.5, 493] },
  { name: 'Volta', d: 'M324.6 274.3 L328.6 243.1 L320.7 305.5 L352.3 359.1 L376 439.4 L376 475.1 L328.6 501.8 L308.8 479.5 L289 434.9 L330.2 376.9 L320.7 305.5 Z', pin: [318.3, 429.6], label: [318.3, 446.6] },
  { name: 'Western', d: 'M65.9 385.8 L190.1 466.2 L178.2 568.8 L114.9 582.2 L59.6 577.7 L35.8 564.3 L23.2 484 L51.6 394.8 Z', pin: [141.8, 582.2], label: [141.8, 599.2] },
  { name: 'Central', d: 'M190.1 466.2 L257.4 434.9 L237.6 524.2 L209.9 528.6 L178.2 568.8 Z', pin: [179.8, 563.4], label: [179.8, 580.4] },
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
        viewBox="0 0 400 620"
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
        <ellipse cx="200" cy="300" rx="210" ry="290" fill={`url(#${glowId})`} />

        <path d={OUTLINE} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.34)" strokeWidth="2" />

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
