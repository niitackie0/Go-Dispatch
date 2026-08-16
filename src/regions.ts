/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Where GO DISPATCH delivers, from its base in Adabraka, Accra.
 *
 * The customer picks a REGION, not a town. The towns are kept alongside each
 * region for two reasons: they are what the flyer actually advertises, and
 * three of them — Cape Coast, Winneba and Swedru — are all in Central, so the
 * region alone would not tell a rider where the parcel is going. They are shown
 * as a hint under the picker, and the exact delivery address is still required.
 *
 * Nine regions, thirteen towns. Adding one is a one-line change here — no
 * migration, because an order stores the region as text rather than as a
 * database enum.
 *
 * Spellings are the standard ones. The printed flyer reads "Temale",
 * "Kofiridua" and "Bolga"; those are Tamale, Koforidua and Bolgatanga.
 *
 * This file must stay free of server-only imports so it can be bundled.
 */
export interface Region {
  name: string;
  /** The towns served within this region, as advertised. */
  towns: readonly string[];
}

export const REGIONS: readonly Region[] = [
  { name: 'Ashanti',     towns: ['Kumasi'] },
  { name: 'Bono',        towns: ['Sunyani'] },
  { name: 'Central',     towns: ['Cape Coast', 'Winneba', 'Swedru'] },
  { name: 'Eastern',     towns: ['Koforidua'] },
  { name: 'Northern',    towns: ['Tamale'] },
  { name: 'Upper East',  towns: ['Bolgatanga'] },
  { name: 'Upper West',  towns: ['Wa'] },
  { name: 'Volta',       towns: ['Ho', 'Hohoe'] },
  { name: 'Western',     towns: ['Takoradi', 'Tarkwa'] },
];

export const REGION_NAMES = REGIONS.map((r) => r.name);

/** Every town served, flattened — for the footer and the coverage copy. */
export const ALL_TOWNS = REGIONS.flatMap((r) => r.towns);

export function isRegion(value: unknown): value is string {
  return typeof value === 'string' && REGION_NAMES.includes(value);
}

export function townsIn(region: string): readonly string[] {
  return REGIONS.find((r) => r.name === region)?.towns ?? [];
}

/** Collection is Accra-only — the office is in Adabraka. */
export const PICKUP_CITY = 'Accra';
