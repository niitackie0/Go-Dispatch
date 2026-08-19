/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Ghanaian phone numbers, in one shape.
 *
 * Numbers used to be stored exactly as typed, and people type the same number
 * five ways: `0244815203`, `024 481 5203`, `+233244815203`, `233244815203`,
 * `244815203`. Every one of those is the same handset and none of them matched
 * the others, so tracking — which looks a number up by exact comparison —
 * answered "nothing found" to a customer who was holding the right number and
 * had merely written it differently than they had a week earlier.
 *
 * So one canonical form goes in the database, E.164 with the plus, and the
 * variety is pushed to the two edges where it belongs:
 *
 *   coming in   toE164 accepts anything a person might type
 *   going out   formatPhone puts it back the way Ghana writes it
 *
 * Shared between client and server deliberately: the console shows numbers,
 * the booking form collects them, the server stores and texts them, and a
 * second implementation of this would drift within a month.
 *
 * WHAT IS NOT NORMALISED. A number that is not a Ghanaian mobile — a landline,
 * a foreign number, a typo — comes back null, and callers store what the person
 * typed instead. Refusing to save it would be worse: the office can still ring
 * a Nigerian number, and a courier company that cannot take an unusual number
 * has a bug, not a standard.
 */

/** Ghana's mobile prefixes are 02x and 05x once the country code is on. */
const GHANA_MOBILE = /^233[25]\d{8}$/;

/**
 * Anything a person might type, to `+233XXXXXXXXX`. Null if it is not a
 * Ghanaian mobile number.
 */
export function toE164(raw: string | null | undefined): string | null {
  const digits = toMsisdn(raw);
  return digits ? `+${digits}` : null;
}

/**
 * The same, without the plus, which is what Arkesel's API wants.
 *
 * Kept separate rather than making callers slice a character off, because a
 * `+` sent to that endpoint fails as an invalid recipient rather than as
 * anything that names the problem.
 */
export function toMsisdn(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);

  // 0241234567 -> 233241234567
  if (digits.startsWith('0')) digits = `233${digits.slice(1)}`;
  // 241234567 -> 233241234567, for anyone who omitted the trunk zero
  else if (digits.length === 9) digits = `233${digits}`;

  return GHANA_MOBILE.test(digits) ? digits : null;
}

/** Whether this is a number we could actually text. */
export function isGhanaMobile(raw: string | null | undefined): boolean {
  return toMsisdn(raw) !== null;
}

/**
 * Back to the way it is written on a shopfront: `024 481 5203`.
 *
 * Nobody in Accra reads out `+233244815203`, and a console that displays it
 * that way makes staff translate in their heads before dialling. Anything that
 * is not a Ghanaian mobile is returned untouched — it is already whatever the
 * person who typed it meant.
 */
export function formatPhone(stored: string | null | undefined): string {
  if (!stored) return '';
  const digits = toMsisdn(stored);
  if (!digits) return String(stored);

  const local = `0${digits.slice(3)}`; // 233244815203 -> 0244815203
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/**
 * What to write to the database for a number somebody typed.
 *
 * Canonical when it can be, trimmed as typed when it cannot. Never empty when
 * something was supplied — losing a contact number is worse than storing an
 * odd one.
 */
export function storablePhone(raw: string): string {
  return toE164(raw) ?? raw.trim();
}

/**
 * Every form of a number worth searching for.
 *
 * Rows written before normalisation still hold whatever was typed, so a lookup
 * has to try both the canonical form and the raw one. Once nothing predates
 * the migration this can shrink to just the canonical form — but there is no
 * hurry, and being wrong about that costs a customer their parcel.
 */
export function phoneSearchVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const canonical = toE164(trimmed);
  const msisdn = toMsisdn(trimmed);

  return [
    ...new Set(
      [
        trimmed,
        trimmed.replace(/\s+/g, ''),
        canonical,
        msisdn,
        msisdn ? `0${msisdn.slice(3)}` : null,
      ].filter((v): v is string => !!v)
    ),
  ];
}
