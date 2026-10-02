import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ErrorCode } from '@indice/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppException } from '../../src/common/app-exception';
import { HttpExceptionFilter } from '../../src/common/http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();
  afterEach(() => vi.restoreAllMocks());

  it('respeta el código, los detalles y el retry de un AppException', () => {
    const ex = new AppException(ErrorCode.RateLimited, 429, 'Muy rápido', undefined, 48);
    expect(filter.toResponse(ex)).toEqual({
      status: 429,
      body: { error: { code: 'RATE_LIMITED', message: 'Muy rápido', retryAfterSeconds: 48 } },
    });
  });

  it('traduce un 404 de Nest a NOT_FOUND', () => {
    expect(filter.toResponse(new NotFoundException()).body.error.code).toBe('NOT_FOUND');
  });

  it('traduce otros 4xx de Nest a VALIDATION_FAILED', () => {
    const { status, body } = filter.toResponse(new BadRequestException('JSON inválido'));
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('oculta el detalle de los errores inesperados', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    for (const ex of [new Error('db caída'), new InternalServerErrorException('x')]) {
      expect(filter.toResponse(ex)).toEqual({
        status: 500,
        body: { error: { code: 'INTERNAL', message: 'Tuvimos un problema de nuestro lado' } },
      });
    }
  });
});
