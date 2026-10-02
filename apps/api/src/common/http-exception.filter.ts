import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiErrorBody, ErrorCode } from '@indice/shared';
import type { Response } from 'express';
import { AppException } from './app-exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toResponse(exception);
    const retryAfter = body.error.retryAfterSeconds;
    if (retryAfter !== undefined) res.setHeader('Retry-After', String(retryAfter));
    res.status(status).json(body);
  }

  toResponse(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof AppException) {
      return { status: exception.getStatus(), body: exception.toBody() };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === HttpStatus.NOT_FOUND) {
        return { status, body: { error: { code: ErrorCode.NotFound, message: 'No encontrado' } } };
      }
      if (status < 500) {
        return {
          status,
          body: { error: { code: ErrorCode.ValidationFailed, message: exception.message } },
        };
      }
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: ErrorCode.Internal, message: 'Tuvimos un problema de nuestro lado' } },
    };
  }
}
