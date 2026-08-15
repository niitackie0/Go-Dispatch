/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { asyncRouter } from '../http.js';
import { requireAdmin } from '../auth.js';
import { prisma } from '../prisma.js';

export const pricingRouter = asyncRouter();

pricingRouter.get('/', async (_req, res) => {
  const pricing = await prisma.pricingConfig.findUnique({ where: { id: 1 } });
  if (!pricing) {
    return res.status(500).json({ error: 'Pricing is not configured' });
  }

  res.json({
    small: pricing.small,
    medium: pricing.medium,
    large: pricing.large,
    currency: pricing.currency,
  });
});

pricingRouter.patch('/', requireAdmin, async (req, res) => {
  const { small, medium, large } = req.body ?? {};

  // Prices are integer pesewas; a fractional or negative price is a bug
  // upstream, not something to round silently.
  const data: { small?: number; medium?: number; large?: number } = {};
  for (const [key, value] of Object.entries({ small, medium, large })) {
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return res.status(400).json({ error: `Invalid price for ${key}` });
    }
    data[key as 'small' | 'medium' | 'large'] = value;
  }

  const pricing = await prisma.pricingConfig.update({ where: { id: 1 }, data });

  res.json({
    success: true,
    pricing: {
      small: pricing.small,
      medium: pricing.medium,
      large: pricing.large,
      currency: pricing.currency,
    },
  });
});
