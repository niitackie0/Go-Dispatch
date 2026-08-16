/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Where GO DISPATCH delivers to, from its base in Adabraka, Accra.
 *
 * Shared deliberately: the server validates bookings against this list and the
 * customer site builds its dropdown from it, so a town cannot appear in the
 * form that the API would reject.
 *
 * Adding a town is a one-line change here — no migration, because the order
 * stores the town as text rather than as a database enum.
 *
 * Spellings are the standard ones. The printed flyer reads "Temale",
 * "Kofiridua" and "Bolga"; those are Tamale, Koforidua and Bolgatanga.
 *
 * This file must stay free of server-only imports so it can be bundled.
 */
export const DESTINATIONS = [
  'Kumasi',
  'Sunyani',
  'Koforidua',
  'Tarkwa',
  'Takoradi',
  'Cape Coast',
  'Winneba',
  'Swedru',
  'Ho',
  'Hohoe',
  'Tamale',
  'Wa',
  'Bolgatanga',
] as const;

export type Destination = (typeof DESTINATIONS)[number];

export function isDestination(value: unknown): value is Destination {
  return typeof value === 'string' && (DESTINATIONS as readonly string[]).includes(value);
}

/** Collection is Accra-only — the office is in Adabraka. */
export const PICKUP_CITY = 'Accra';
