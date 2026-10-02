import { describe, expect, it } from 'vitest';
import { normalizeStoreName } from '../../src/modules/stores/domain/normalize-name';

describe('normalizeStoreName', () => {
  it('saca tildes, mayúsculas y signos', () => {
    expect(normalizeStoreName('  Verdulería "Don Pepe" — Ñandú  ')).toBe(
      'verduleria don pepe nandu',
    );
  });

  it('conserva números', () => {
    expect(normalizeStoreName('Super 24 hs.')).toBe('super 24 hs');
  });
});
