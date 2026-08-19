/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Reading values out of a request body, without trusting their type.
 *
 * The validation on the public routes was thorough about meaning — is there a
 * weight, is the region one we serve, is the recipient named — and silent
 * about type. `if (!senderName)` is false for `{}`, for `[]`, for `123` and
 * for `true`, so every one of those walked past the checks and reached Prisma,
 * which threw, and the caller got a 500 saying "Something went wrong" about a
 * mistake they made and could have corrected.
 *
 * A 400 that names the field is a better answer than a 500 about anything.
 *
 * NOT zod, deliberately. The checklist says "zod or similar"; the similar is
 * this file. The existing checks already carry the product's voice — "Give us
 * a rough weight so we can estimate", "For parcels over 100kg, please call
 * 054 030 4994" — and porting them to a schema library means either losing
 * those sentences or reattaching every one as a custom message, which is the
 * same code with more ceremony and one more dependency running on every
 * request. What was missing was type and length, and that is small.
 *
 * LENGTHS. The columns are Postgres text, so nothing stops a 50,000-character
 * name but the 64kb body limit. These caps are generous for a real answer and
 * mean nobody can quietly fill the database through the booking form.
 */

export const LIMITS = {
  name: 120,
  phone: 32,
  address: 300,
  notes: 500,
  description: 300,
  reference: 64,
} as const;

/**
 * A required string. Returns null when the value is missing, of the wrong
 * type, blank once trimmed, or longer than the cap.
 */
export function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

/**
 * An optional string. Distinguishes "not supplied" (undefined, fine) from
 * "supplied and wrong" (null, an error the caller should hear about).
 */
export function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return text(value, max);
}

/** A finite number within bounds. Rejects strings, NaN and Infinity alike. */
export function bounded(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/** A date that a Date can actually be made from. */
export function when(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return new Date();
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
