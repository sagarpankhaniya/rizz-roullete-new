import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';
import type { ApiErrorResponse } from '../interfaces/api-response.interface';

/**
 * WHY global exception filter:
 * No raw Nest stack traces to clients in production.
 * Structured error shape matches future Socket error envelope.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.normalize(exception, request);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private normalize(
    exception: unknown,
    request: Request,
  ): { status: number; body: ApiErrorResponse } {
    const timestamp = new Date().toISOString();
    const path = request.url;

    if (exception instanceof AppException) {
      const response = exception.getResponse() as {
        code: string;
        message: string;
        details?: unknown;
      };

      return {
        status: exception.getStatus(),
        body: {
          success: false,
          error: {
            code: response.code,
            message: response.message,
            details: response.details,
          },
          path,
          timestamp,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return {
          status,
          body: {
            success: false,
            error: {
              code: HttpStatus[status] ?? 'HTTP_ERROR',
              message: exceptionResponse,
            },
            path,
            timestamp,
          },
        };
      }

      const payload = exceptionResponse as Record<string, unknown>;
      const message = Array.isArray(payload.message)
        ? payload.message.join(', ')
        : String(payload.message ?? exception.message);

      return {
        status,
        body: {
          success: false,
          error: {
            code: String(payload.error ?? HttpStatus[status] ?? 'HTTP_ERROR'),
            message,
            details: payload.message,
          },
          path,
          timestamp,
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
        path,
        timestamp,
      },
    };
  }
}

