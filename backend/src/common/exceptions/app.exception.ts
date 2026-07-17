import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Domain-friendly error codes for HTTP + (later) Socket envelopes.
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

