/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router } from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AnyHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => unknown | Promise<unknown>;

function forwardRejections(handler: AnyHandler): RequestHandler {
  return (req, res, next) => {
    try {
      const result = handler(req, res, next);
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

const METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;

/**
 * A Router whose handlers may be async.
 *
 * Express 4 does not await route handlers, so a rejected promise becomes an
 * unhandled rejection and takes the process down — one slow Neon query is
 * enough. This forwards rejections to the error middleware instead, where they
 * become a 500 and the server stays up.
 */
export function asyncRouter(): Router {
  const router = Router();

  for (const method of METHODS) {
    const original = router[method].bind(router) as (
      path: string,
      ...handlers: RequestHandler[]
    ) => Router;

    (router as unknown as Record<string, unknown>)[method] = (
      path: string,
      ...handlers: AnyHandler[]
    ) => original(path, ...handlers.map(forwardRejections));
  }

  return router;
}
