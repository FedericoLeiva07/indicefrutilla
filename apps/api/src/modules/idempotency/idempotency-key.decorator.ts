import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ErrorCode } from '@indice/shared';
import type { Request } from 'express';
import { AppException } from '../../common/app-exception';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseIdempotencyKey(header: string | undefined): string | undefined {
  if (header === undefined) return undefined;
  if (!UUID.test(header)) {
    throw new AppException(ErrorCode.ValidationFailed, 400, 'Idempotency-Key inválida', [
      { field: 'Idempotency-Key', code: 'isUuid' },
    ]);
  }
  return header.toLowerCase();
}

export const IdempotencyKey = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | undefined =>
    parseIdempotencyKey(ctx.switchToHttp().getRequest<Request>().header('idempotency-key')),
);
