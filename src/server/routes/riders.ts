/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { asyncRouter } from '../http.js';
import { requireAdmin } from '../auth.js';
import { prisma } from '../prisma.js';
import { serializeRider } from '../serialize.js';

export const ridersRouter = asyncRouter();

/** Fleet roster — the dashboard uses this to show rider availability. */
ridersRouter.get('/', requireAdmin, async (_req, res) => {
  const riders = await prisma.rider.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(riders.map(serializeRider));
});
