/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { asyncRouter } from '../http.js';
import { requireAdmin } from '../auth.js';
import { requirePermission } from '../permissions.js';
import { prisma } from '../prisma.js';
import type { PricingRule } from '../../pricing.js';

export const pricingRouter = asyncRouter();

/** The rate the whole system prices against. */
export async function currentRule(): Promise<PricingRule> {
  const row = await prisma.pricingConfig.findUnique({ where: { id: 1 } });
  if (!row) throw new Error('Pricing is not configured');
  return {
    baseAmount: row.baseAmount,
    includedKg: row.includedKg,
    perExtraKgAmount: row.perExtraKgAmount,
    currency: row.currency,
  };
}

pricingRouter.get('/', async (_req, res) => {
  try {
    res.json(await currentRule());
  } catch {
    res.status(500).json({ error: 'Pricing is not configured' });
  }
});

pricingRouter.patch('/', requireAdmin, requirePermission('pricing:write'), async (req, res) => {
  const { baseAmount, includedKg, perExtraKgAmount } = req.body ?? {};

  // Amounts are integer pesewas and the allowance is a whole number of kilos.
  // A fraction or a negative here is a bug upstream, not something to round
  // away quietly.
  const data: Partial<Record<'baseAmount' | 'includedKg' | 'perExtraKgAmount', number>> = {};
  for (const [key, value] of Object.entries({ baseAmount, includedKg, perExtraKgAmount })) {
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return res.status(400).json({ error: `Invalid value for ${key}` });
    }
    data[key as keyof typeof data] = value;
  }

  // An allowance of zero would bill the very first kilo as an extra, which is
  // not what "flat rate up to 3kg" means anywhere.
  if (data.includedKg !== undefined && data.includedKg < 1) {
    return res.status(400).json({ error: 'The included weight must be at least 1kg' });
  }

  await prisma.pricingConfig.update({ where: { id: 1 }, data });

  res.json({ success: true, pricing: await currentRule() });
});
