/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from 'express';
import { can, type Capability } from '../capabilities.js';

export { can, capabilitiesFor, CAPABILITIES, type Capability } from '../capabilities.js';

/**
 * Gate a route on a capability. Composes after requireAdmin, which is what
 * puts req.admin in place.
 *
 * The capability table itself lives in src/capabilities.ts so the admin UI can
 * import it to decide which controls to show. This file is the enforcement —
 * the UI is only a convenience.
 */
export function requirePermission(capability: Capability) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const admin = req.admin;

    if (!admin) {
      // requireAdmin missing from the chain — a wiring bug, not a user error.
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!can(admin.role, capability)) {
      res.status(403).json({ error: 'Your role does not allow this action' });
      return;
    }

    next();
  };
}
