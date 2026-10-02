import { describe, expect, it } from 'vitest';
import {
  normalizeStoreName,
  storeSearchTerm,
} from '../../src/modules/stores/domain/normalize-name';

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

describe('storeSearchTerm', () => {
  it('saca las palabras genéricas del rubro', () => {
    expect(storeSearchTerm('Verdulería Pepe')).toBe('pepe');
    expect(storeSearchTerm('Frutería La Esquina')).toBe('esquina');
  });

  it('usa el término completo si solo hay palabras genéricas', () => {
    expect(storeSearchTerm('Verdulería')).toBe('verduleria');
  });
});
