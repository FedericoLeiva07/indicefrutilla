import type { ValidationError } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { toFieldErrors } from '../../src/common/validation';

describe('toFieldErrors', () => {
  it('devuelve un código por campo, incluidos los anidados', () => {
    const errors = [
      { property: 'lat', constraints: { isLatitude: 'lat must be a latitude' }, children: [] },
      {
        property: 'store',
        children: [
          { property: 'name', constraints: { isNotEmpty: '…', maxLength: '…' }, children: [] },
        ],
      },
    ] as unknown as ValidationError[];

    expect(toFieldErrors(errors)).toEqual([
      { field: 'lat', code: 'isLatitude' },
      { field: 'store.name', code: 'isNotEmpty' },
    ]);
  });
});
