import { HttpException } from '@nestjs/common';
import type { ApiErrorBody, ErrorCode } from '@indice/shared';

export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: number,
    message: string,
    readonly details?: unknown,
    readonly retryAfterSeconds?: number,
  ) {
    super(message, status);
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.retryAfterSeconds !== undefined && { retryAfterSeconds: this.retryAfterSeconds }),
        ...(this.details !== undefined && { details: this.details }),
      },
    };
  }
}
