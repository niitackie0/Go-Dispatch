/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SMS text handling: what a message costs, and what a phone number has to look
 * like before a provider will take it.
 *
 * No network here. This is the part that has to be right before a sender is
 * wired up, because both facts below are billed per message, on every order,
 * forever.
 *
 * THE ONE THING TO KNOW: an SMS is not "160 characters". It is 160 characters
 * *if every character is in the GSM 03.38 alphabet*. One character outside it —
 * a curly apostrophe pasted from Word, an em dash, an accented name — switches
 * the whole message to UCS-2 and the limit drops to 70. A 150-character message
 * silently becomes three billed segments instead of one because somebody typed
 * "don’t" instead of "don't".
 *
 * So messages are sanitised into GSM-7 before they are queued, and their
 * segment count is measured rather than assumed.
 */

/** GSM 03.38 basic alphabet. Each of these costs one septet. */
const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
);

/** The extension table. These are sent as an escape plus the character: two septets. */
const GSM7_EXTENDED = new Set('^{}\\[~]|€');

/**
 * Punctuation that looks identical in a proof-read but is not in the GSM
 * alphabet. Every one of these is a message that quietly costs double.
 */
const LOOKALIKES: Record<string, string> = {
  '’': "'", // right single quote
  '‘': "'",
  '“': '"',
  '”': '"',
  '–': '-', // en dash
  '—': '-', // em dash
  '…': '...',
  ' ': ' ', // non-breaking space
  '•': '-',
  '·': '-',
  '′': "'",
  '″': '"',
};

/**
 * Force text into the GSM-7 alphabet.
 *
 * Lookalike punctuation is swapped for its plain equivalent, then accents are
 * decomposed and stripped — "Ofori-Attà" becomes "Ofori-Atta" rather than
 * doubling the cost of the message it appears in. Anything still outside the
 * alphabet after that is dropped, because a character a provider cannot encode
 * is worse than an absent one: it arrives as a black diamond, or not at all.
 */
export function toGsm7(text: string): string {
  let out = '';

  for (const char of text.replace(/[‘’“”–—… •·′″]/g, (c) => LOOKALIKES[c] ?? c)) {
    if (GSM7_BASIC.has(char) || GSM7_EXTENDED.has(char)) {
      out += char;
      continue;
    }

    // é -> e, ñ -> n. Keeps the name readable at single-segment cost.
    const stripped = char.normalize('NFD').replace(/\p{M}/gu, '');
    if (stripped && [...stripped].every((c) => GSM7_BASIC.has(c) || GSM7_EXTENDED.has(c))) {
      out += stripped;
    }
  }

  return out;
}

/** Whether every character can be sent as GSM-7 (i.e. at 160 rather than 70). */
export function isGsm7(text: string): boolean {
  return [...text].every((c) => GSM7_BASIC.has(c) || GSM7_EXTENDED.has(c));
}

export interface SmsCost {
  /** Billed parts. This is the number that multiplies by the per-message rate. */
  segments: number;
  /** Encoded length: septets for GSM-7, UTF-16 units for UCS-2. */
  length: number;
  encoding: 'GSM-7' | 'UCS-2';
  /** Characters still available before another segment is billed. */
  remaining: number;
}

/**
 * What this message will actually cost to send.
 *
 * The per-segment limits drop once a message needs more than one part, because
 * concatenation eats bytes from each segment for the reassembly header: 160
 * becomes 153, and 70 becomes 67.
 */
export function smsCost(text: string): SmsCost {
  const gsm = isGsm7(text);

  if (gsm) {
    let length = 0;
    for (const c of text) length += GSM7_EXTENDED.has(c) ? 2 : 1;
    const segments = length <= 160 ? 1 : Math.ceil(length / 153);
    const capacity = segments === 1 ? 160 : segments * 153;
    return { segments, length, encoding: 'GSM-7', remaining: capacity - length };
  }

  const length = text.length; // UTF-16 units, which is what UCS-2 bills
  const segments = length <= 70 ? 1 : Math.ceil(length / 67);
  const capacity = segments === 1 ? 70 : segments * 67;
  return { segments, length, encoding: 'UCS-2', remaining: capacity - length };
}

/**
 * A Ghanaian mobile number in the form a provider will accept.
 *
 * Numbers are stored on an order exactly as the customer typed them — "024 123
 * 4567", "+233241234567", "0241234567" are all the same phone. Providers want
 * one form, so this is where that is settled, and where a number that cannot be
 * one is rejected rather than queued as an SMS that will never arrive.
 *
 * Returns null for anything that is not a Ghanaian mobile number.
 */
export function toGhanaMsisdn(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);

  // 0241234567 -> 233241234567
  if (digits.startsWith('0')) digits = `233${digits.slice(1)}`;
  // 241234567 -> 233241234567, for anyone who omitted the trunk zero
  else if (digits.length === 9) digits = `233${digits}`;

  if (!/^233[25]\d{8}$/.test(digits)) return null;

  return digits;
}

/** True when this is a number we could actually text. */
export function isSendableGhanaNumber(raw: string | null | undefined): boolean {
  return toGhanaMsisdn(raw) !== null;
}
