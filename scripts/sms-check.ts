/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Is the SMS key working?
 *
 *     npm run sms:check
 *
 * Asks the provider for the account balance, which sends nothing and costs
 * nothing. Useful after rotating the key, when the question is simply "did I
 * paste it correctly", and there is no way to answer that by sending a message
 * you did not want to send.
 *
 * Deliberately ignores the SMS_PROVIDER switch. Reading a balance is not
 * sending, so this works while sending is still off — which is exactly when
 * you need it.
 */

import 'dotenv/config';

const key = process.env.SMS_API_KEY;
if (!key) {
  console.log('\nSMS_API_KEY is not set in .env.\n');
  process.exit(1);
}

// Forced before the provider module is loaded, because its own guard treats an
// unset provider as "sending is off" — which is true, and irrelevant here.
process.env.SMS_PROVIDER = process.env.SMS_PROVIDER || 'arkesel';

const { smsBalance } = await import('../src/server/smsProvider.js');
const raw = await smsBalance();

console.log(`\nProvider: ${process.env.SMS_PROVIDER}`);
console.log(`Key:      ...${key.slice(-6)}  (${key.length} characters)\n`);

try {
  const parsed = JSON.parse(raw);
  if (parsed?.status === 'success') {
    const sms = parsed.data?.sms_balance;
    const cash = parsed.data?.main_balance;
    console.log('The key works.');
    if (sms !== undefined) console.log(`  ${sms} SMS credits`);
    if (cash !== undefined) console.log(`  ${cash} cash balance`);
    console.log('');
    process.exit(0);
  }
  console.log(`The provider refused it: ${parsed?.message ?? raw}\n`);
  process.exit(1);
} catch {
  console.log(`Unexpected reply from the provider:\n  ${raw}\n`);
  process.exit(1);
}
