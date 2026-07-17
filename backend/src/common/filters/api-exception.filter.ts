import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === 'object' && body !== null) {
      const b = body as {
        message?: string | string[] | Record<string, unknown>;
        error?: string;
        code?: string;
      };

      // Nested payload from ForbiddenException({ error, code })
      if (
        typeof b.message === 'object' &&
        b.message !== null &&
        !Array.isArray(b.message)
      ) {
        const nested = b.message as { error?: string; code?: string };
        response.status(status).json({
          error: nested.error ?? 'Request failed',
          code: nested.code,
        });
        return;
      }

      if (b.code || (typeof b.error === 'string' && b.error !== 'Forbidden')) {
        response.status(status).json({
          error: b.error ?? 'Request failed',
          code: b.code,
        });
        return;
      }

      const message = b.message;
      const errorText = Array.isArray(message)
        ? message.join(', ')
        : typeof message === 'string'
          ? message
          : undefined;

      response.status(status).json({ error: errorText ?? 'Request failed' });
      return;
    }

    response.status(status).json({
      error: typeof body === 'string' ? body : 'Request failed',
    });
  }
}


