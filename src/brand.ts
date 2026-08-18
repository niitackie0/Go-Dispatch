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

/**
 * The name automation signs its status_history rows with.
 *
 * A constant rather than a literal because undo reads it back: a step the
 * rules engine took is not a step a person can revert, and that decision is
 * made by comparing against this exact string.
 */
export const AUTOMATION_ACTOR = `${BRAND_NAME} Automation`;

/** As printed, for humans to read and dial. */
export const CONTACT_PHONE = '054 030 4994';
/** Same number in international form, for tel: and wa.me links. */
export const CONTACT_PHONE_E164 = '+233540304994';

export const WHATSAPP_URL = 'https://wa.me/233540304994';

/**
 * The alphanumeric sender ID customers should see an SMS arrive from.
 *
 * Eleven characters is the GSM limit for one, and "GO DISPATCH" is exactly
 * eleven. It has to be registered with the provider (Arkesel, Hubtel or
 * mNotify) before it works.
 */
export const SMS_SENDER_ID = 'GO DISPATCH';

/**
 * Whether that registration has come through.
 *
 * While false, messages arrive from a shortcode and have to name us in the
 * body, which costs 13 characters of a 160-character message every time. Flip
 * this the day the sender ID is approved and every template gets those
 * characters back — nothing else needs to change.
 */
export const SMS_SENDER_ID_REGISTERED = false;

export const OFFICE_ADDRESS = 'Adabraka, Accra';
export const OFFICE_LANDMARK = 'Closer to Odorna Clinic';

/** The three promises on the flyer. */
export const BRAND_PROMISES = ['Safe', 'Fast', 'Reliable'] as const;

/**
 * Social profiles.
 *
 * Instagram and TikTok are the handles the owner gave us, with the share
 * tracking stripped — the `?igsh=` and `?_t=` parameters on a shared link are
 * one-off referral tokens tied to whoever copied it, not part of the address.
 * Facebook is deliberately blank: an invented facebook.com/godispatch would
 * either 404 or, worse, point customers at somebody else's page. The footer
 * renders only the entries with a URL, so filling it in is all that is needed
 * to light it up.
 */
export const SOCIAL: { name: string; url: string }[] = [
  { name: 'WhatsApp', url: WHATSAPP_URL },
  { name: 'Instagram', url: 'https://www.instagram.com/go_dispatch' },
  { name: 'TikTok', url: 'https://www.tiktok.com/@go_dispatch' },
  { name: 'Snapchat', url: 'https://snapchat.com/t/pCO24mO6' },
  { name: 'Facebook', url: '' },
];

/** When a rider can actually be sent, and when the phone is answered. */
export const OPENING_HOURS = [
  { days: 'Monday to Friday', hours: '8am – 5pm' },
  { days: 'Saturday', hours: '8am – 5pm' },
  { days: 'Sunday', hours: 'Closed' },
];
