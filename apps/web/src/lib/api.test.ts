import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { toApiError } from './api';

function axiosError(status?: number, data?: unknown): AxiosError {
  const response = status
    ? { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
    : undefined;
  return new AxiosError('x', 'ERR', undefined, undefined, response);
}

describe('toApiError', () => {
  it('toma el código y el retry del cuerpo de la API', () => {
    const err = toApiError(
      axiosError(429, {
        error: { code: 'RATE_LIMITED', message: 'Muy rápido', retryAfterSeconds: 48 },
      }),
    );
    expect(err).toMatchObject({ code: 'RATE_LIMITED', status: 429, retryAfterSeconds: 48 });
    expect(err.displayCode).toBe('E-429');
  });

  it('marca como NETWORK un error sin respuesta', () => {
    expect(toApiError(axiosError()).code).toBe('NETWORK');
  });

  it('trata una respuesta sin cuerpo de la API como INTERNAL', () => {
    expect(toApiError(axiosError(502, '<html>')).code).toBe('INTERNAL');
  });
});
