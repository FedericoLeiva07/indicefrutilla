import { describe, expect, it } from 'vitest';
import { IdempotencyService, stableJson } from '../../src/modules/idempotency/idempotency.service';

describe('stableJson', () => {
  it('no depende del orden de las claves y omite undefined', () => {
    expect(stableJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe(
      '{"a":{"d":[1,{"x":1,"y":2}]},"b":1}',
    );
  });

  it('el hash distingue el endpoint', () => {
    const body = { a: 1 };
    expect(IdempotencyService.hash('POST /stores', body)).not.toEqual(
      IdempotencyService.hash('POST /reports', body),
    );
    expect(IdempotencyService.hash('POST /stores', { a: 1 })).toEqual(
      IdempotencyService.hash('POST /stores', body),
    );
  });
});
