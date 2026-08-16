/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId, useState } from 'react';
import { REGIONS } from '../regions.js';
import { GHANA_REGIONS, MAP_VIEWBOX } from '../ghanaRegions.js';

/**
 * Ghana, all sixteen regions, drawn from real boundary data.
 *
 * Shapes come from geoBoundaries gbOpen GHA ADM1 (CC BY 4.0) — see
 * src/ghanaRegions.ts for the projection and simplification.
 *
 * The nine regions we deliver to are filled, pinned, routed and interactive.
 * The other six are outlined only: no pin, no route, no hover, not clickable.
 * Drawing them keeps the country whole and honest — the map shows Ghana rather
 * than an odd shape made only of the parts we happen to cover — while leaving
 * no doubt about where we actually go.
 */

interface GhanaMapProps {
  /** Called with a region name when a served region is chosen. */
  onSelect?: (region: string) => void;
  className?: string;
}

export default function GhanaMap({ onSelect, className = '' }: GhanaMapProps) {
  const glowId = useId();
  const [active, setActive] = useState<string | null>(null);

  const townsFor = (name: string) =>
    REGIONS.find((r) => r.name === name)?.towns.join(' · ') ?? '';

  const origin = GHANA_REGIONS.find((r) => r.role === 'origin');
  const served = GHANA_REGIONS.filter((r) => r.role === 'served');
  const other = GHANA_REGIONS.filter((r) => r.role === 'other');

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={MAP_VIEWBOX}
        className="w-full h-auto"
        role="group"
        aria-label="Map of Ghana showing the regions GO DISPATCH delivers to"
      >
        <defs>
          <radialGradient id={glowId} cx="50%" cy="45%" r="62%">
            <stop offset="0%" stopColor="#FF5057" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#FF5057" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="210" cy="300" rx="215" ry="300" fill={`url(#${glowId})`} />

        {/* Regions we do not serve — drawn so the country is whole, but given
            nothing that suggests we go there. */}
        {other.map((r) => (
          <path
            key={r.name}
            d={r.d}
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.8"
          />
        ))}

        {/* Routes out of Accra, to served regions only. */}
        {origin && (
          <g stroke="#FF5057" strokeWidth="1.1" strokeDasharray="4 6" opacity="0.4" fill="none">
            {served.map((r) => (
              <path key={r.name} d={`M${origin.c[0]} ${origin.c[1]} L${r.c[0]} ${r.c[1]}`} />
            ))}
          </g>
        )}

        {served.map((r) => {
          const on = active === r.name;
          return (
            <path
              key={r.name}
              d={r.d}
              fill={on ? 'rgba(255,80,87,0.34)' : 'rgba(255,80,87,0.11)'}
              stroke={on ? '#FF5057' : 'rgba(255,120,126,0.55)'}
              strokeWidth={on ? 1.8 : 1}
              style={{ transition: 'fill 180ms ease, stroke 180ms ease' }}
            />
          );
        })}

        {origin && (
          <path d={origin.d} fill="rgba(255,80,87,0.62)" stroke="#FF5057" strokeWidth="1.4" />
        )}

        {/* Pins and labels sit above the fills. The dark stroke behind the text
            keeps it legible wherever it lands on the map. */}
        {served.map((r) => {
          const on = active === r.name;
          return (
            <g key={`${r.name}-pin`} style={{ pointerEvents: 'none' }}>
              <circle
                cx={r.c[0]}
                cy={r.c[1]}
                r={on ? 6 : 4}
                fill="#FF5057"
                style={{ transition: 'r 180ms ease' }}
              />
              <text
                x={r.c[0]}
                y={r.c[1] - 9}
                textAnchor="middle"
                className="fill-white"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  paintOrder: 'stroke',
                  stroke: 'rgba(10,6,7,.78)',
                  strokeWidth: 3,
                }}
              >
                {r.name}
              </text>
            </g>
          );
        })}

        {origin && (
          <g style={{ pointerEvents: 'none' }}>
            <circle cx={origin.c[0]} cy={origin.c[1]} r="5.5" fill="#fff" />
            <text
              x={origin.c[0]}
              y={origin.c[1] + 17}
              textAnchor="middle"
              className="fill-white"
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                paintOrder: 'stroke',
                stroke: 'rgba(10,6,7,.78)',
                strokeWidth: 3,
              }}
            >
              Accra
            </text>
          </g>
        )}

        {/* Hit areas last, so they sit above everything. Served regions only —
            an unserved region is not something you can choose. */}
        {served.map((r) => (
          <path
            key={`${r.name}-hit`}
            d={r.d}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`${r.name} Region — ${townsFor(r.name)}`}
            onMouseEnter={() => setActive(r.name)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(r.name)}
            onBlur={() => setActive(null)}
            onClick={() => onSelect?.(r.name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.(r.name);
              }
            }}
            style={{ cursor: 'pointer', outline: 'none' }}
          />
        ))}
      </svg>

      {/* Height reserved so the layout does not jump as the pointer moves. */}
      <p className="mt-2 min-h-6 text-center text-sm" aria-live="polite">
        {active ? (
          <>
            <span className="font-semibold text-white">{active}</span>
            <span className="text-white/50"> — {townsFor(active)}</span>
          </>
        ) : (
          <span className="text-white/40">Tap a highlighted region to start a booking</span>
        )}
      </p>
    </div>
  );
}
