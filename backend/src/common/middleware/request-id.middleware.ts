import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export const CORRELATION_HEADER = 'x-request-id';

/**
 * WHY correlation IDs:
 * Trace a single HTTP request across Winston logs (and later socket flows).
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(CORRELATION_HEADER);
    const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();

    req.headers[CORRELATION_HEADER] = requestId;
    res.setHeader(CORRELATION_HEADER, requestId);

    const started = Date.now();
    res.on('finish', () => {
      this.logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms rid=${requestId}`,
      );
    });

    next();
  }
}

