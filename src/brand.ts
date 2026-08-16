/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The business's own details, in one place.
 *
 * These appear on the site, in notification copy and on printed material, and
 * they change together — a new number means a new flyer. Keeping them here
 * stops the phone number drifting between the footer, the booking page and the
 * SMS templates.
 *
 * This file must stay free of server-only imports so it can be bundled.
 */
export const BRAND_NAME = 'GO DISPATCH';
export const BRAND_TAGLINE = 'We deliver trust';

/** As printed, for humans to read and dial. */
export const CONTACT_PHONE = '054 030 4994';
/** Same number in international form, for tel: and wa.me links. */
export const CONTACT_PHONE_E164 = '+233540304994';

export const WHATSAPP_URL = 'https://wa.me/233540304994';

export const OFFICE_ADDRESS = 'Adabraka, Accra';
export const OFFICE_LANDMARK = 'Closer to Odorna Clinic';

/** The three promises on the flyer. */
export const BRAND_PROMISES = ['Safe', 'Fast', 'Reliable'] as const;

/**
 * Social profiles.
 *
 * Only WhatsApp is filled in, because it is the one handle I actually have —
 * it is derived from the phone number on the flyer. The rest are blank on
 * purpose: an invented facebook.com/godispatch would either 404 or, worse,
 * point customers at somebody else's page. The footer renders only the ones
 * with a URL, so filling any of these in is all that is needed to light it up.
 */
export const SOCIAL: { name: string; url: string }[] = [
  { name: 'WhatsApp', url: WHATSAPP_URL },
  { name: 'Facebook', url: '' },
  { name: 'Instagram', url: '' },
  { name: 'TikTok', url: '' },
];
