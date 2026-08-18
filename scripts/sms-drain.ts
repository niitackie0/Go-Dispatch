/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Look at the outbox, and optionally send what is in it.
 *
 *     npm run sms:outbox              what is queued, and what would be sent
 *     npm run sms:outbox -- --send    actually send it
 *
 * Dry by default, and deliberately so. The outbox has been filling up with
 * real customer numbers since the first booking, so the first time anybody
 * runs a drain it should show them the list, not text it.
 */

import { prisma } from '../src/server/prisma.js';
import { drainOutbox } from '../src/server/outbox.js';
import { smsBalance, smsEnabled, smsProviderName } from '../src/server/smsProvider.js';
import { smsCost } from '../src/server/sms.js';

const send = process.argv.includes('--send');

const rows = await prisma.notification.findMany({
  orderBy: { createdAt: 'asc' },
  include: { order: { select: { trackingCode: true } } },
});

const pending = rows.filter((r) => r.status === 'pending');
const sent = rows.filter((r) => r.status === 'sent');
const failed = rows.filter((r) => r.status === 'failed');

console.log(`\nProvider: ${smsProviderName()}${smsEnabled() ? '' : '  (sending is OFF — SMS_PROVIDER is unset in .env)'}`);
console.log(`Outbox:   ${pending.length} pending, ${sent.length} sent, ${failed.length} failed\n`);

if (smsEnabled()) {
  console.log(`Balance:  ${await smsBalance()}\n`);
}

if (pending.length > 0) {
  const segments = pending.reduce((sum, r) => sum + smsCost(r.message).segments, 0);
  console.log(`Queued (${segments} billed segment${segments === 1 ? '' : 's'} if sent now):\n`);
  for (const r of pending) {
    const cost = smsCost(r.message);
    console.log(`  ${r.order?.trackingCode ?? '?'}  ${r.event}  -> ${r.recipient}`);
    console.log(`    "${r.message}"`);
    console.log(`    ${cost.segments} segment${cost.segments === 1 ? '' : 's'}, queued ${r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}${r.attempts ? `, ${r.attempts} attempt(s), last error: ${r.lastError}` : ''}\n`);
  }
}

if (failed.length > 0) {
  console.log('Given up on:\n');
  for (const r of failed) {
    console.log(`  ${r.order?.trackingCode ?? '?'}  ${r.event} -> ${r.recipient}: ${r.lastError}\n`);
  }
}

if (!send) {
  console.log(
    pending.length > 0
      ? 'Nothing was sent. Re-run with --send to send the queue above.\n'
      : 'Nothing queued.\n'
  );
  process.exit(0);
}

if (!smsEnabled()) {
  console.log('Cannot send: set SMS_PROVIDER=arkesel in .env first.\n');
  process.exit(1);
}

const result = await drainOutbox();
console.log(`\nSent ${result.sent}, retrying ${result.retrying}, gave up on ${result.failed}.${result.skipped ? ` (${result.skipped})` : ''}\n`);
process.exit(0);
