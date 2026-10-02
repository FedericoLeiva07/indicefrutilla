import { describe, expect, it } from 'vitest';
import {
  draftFromReport,
  draftPricePerKg,
  draftQuantityG,
  formatPriceInput,
  newDraft,
  observedAt,
  parseDecimal,
  validateDraft,
} from './draft';

const draft = (overrides: Partial<ReturnType<typeof newDraft>>) => ({
  ...newDraft(),
  ...overrides,
});

describe('formatPriceInput', () => {
  it('agrega separador de miles y admite hasta 2 decimales', () => {
    expect(formatPriceInput('9200')).toBe('9.200');
    expect(formatPriceInput('$ 1234567')).toBe('1.234.567');
    expect(formatPriceInput('1234,567')).toBe('1.234,56');
    expect(formatPriceInput('0099')).toBe('99');
    expect(formatPriceInput('')).toBe('');
  });
});

describe('parseDecimal', () => {
  it('lee el formato argentino', () => {
    expect(parseDecimal('9.200')).toBe(9200);
    expect(parseDecimal('1.234,5')).toBe(1234.5);
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('')).toBeNull();
  });
});

describe('draftQuantityG', () => {
  it('resuelve las presentaciones fijas', () => {
    expect(draftQuantityG(draft({ presentation: 'g500' }))).toBe(500);
  });

  it('usa los kilos del cajón, también con decimales', () => {
    expect(draftQuantityG(draft({ presentation: 'cajon', cajonKg: '2' }))).toBe(2000);
    expect(
      draftQuantityG(draft({ presentation: 'cajon', cajonKg: 'otro', cajonOtherKg: '3,5' })),
    ).toBe(3500);
    expect(
      draftQuantityG(draft({ presentation: 'cajon', cajonKg: 'otro', cajonOtherKg: '12' })),
    ).toBeNull();
  });

  it('usa los gramos de otro', () => {
    expect(draftQuantityG(draft({ presentation: 'otro', otherGrams: '1.250' }))).toBe(1250);
    expect(draftQuantityG(draft({ presentation: 'otro', otherGrams: '40' }))).toBeNull();
  });
});

describe('draftPricePerKg', () => {
  it('calcula el equivalente por kg en vivo', () => {
    expect(
      draftPricePerKg(draft({ presentation: 'cajon', cajonKg: '2', priceText: '9.200' })),
    ).toBe(4600);
    expect(draftPricePerKg(draft({ presentation: 'cajon', priceText: '9.200' }))).toBeNull();
  });
});

describe('validateDraft (C3)', () => {
  it('pide precio y presentación', () => {
    expect(validateDraft(draft({})).map((e) => e.field)).toEqual(['priceArs', 'presentation']);
  });

  it('pide los kilos del cajón', () => {
    expect(validateDraft(draft({ priceText: '9.200', presentation: 'cajon' }))).toEqual([
      { field: 'quantityG', message: 'Indicá los kilos del cajón para calcular el precio por kg' },
    ]);
    expect(
      validateDraft(
        draft({ priceText: '9.200', presentation: 'cajon', cajonKg: 'otro', cajonOtherKg: '0,5' }),
      ),
    ).toEqual([{ field: 'quantityG', message: 'El cajón tiene que ser de 1 a 10 kg' }]);
  });

  it('acepta un borrador completo', () => {
    expect(validateDraft(draft({ priceText: '2.300', presentation: 'g500' }))).toEqual([]);
  });
});

describe('observedAt', () => {
  it('cuenta los días en hora de Argentina', () => {
    const now = new Date('2026-10-02T01:30:00Z');
    expect(observedAt(0, now)).toBe('2026-10-01');
    expect(observedAt(2, now)).toBe('2026-09-29');
  });
});

describe('draftFromReport', () => {
  const store = {
    id: 7,
    name: 'Verdulería Don Tito',
    address: 'Av. Urquiza 4120',
    location: { lat: -34.6, lng: -58.5 },
  };

  it('copia comercio, presentación y calidad, y deja el precio vacío', () => {
    const d = draftFromReport({ store, presentation: 'g500', quantityG: 500, quality: 'segunda' });
    expect(d.store).toEqual(store);
    expect(d.presentation).toBe('g500');
    expect(d.quality).toBe('segunda');
    expect(d.priceText).toBe('');
    expect(d.daysAgo).toBe(0);
  });

  it('elige los kilos del cajón o los escribe en otro', () => {
    expect(
      draftFromReport({ store, presentation: 'cajon', quantityG: 4000, quality: 'primera' })
        .cajonKg,
    ).toBe('4');
    const otro = draftFromReport({
      store,
      presentation: 'cajon',
      quantityG: 3500,
      quality: 'primera',
    });
    expect(otro.cajonKg).toBe('otro');
    expect(otro.cajonOtherKg).toBe('3,5');
    expect(draftQuantityG(otro)).toBe(3500);
  });

  it('usa una clave de idempotencia nueva', () => {
    const a = draftFromReport({ store, presentation: 'otro', quantityG: 750, quality: 'primera' });
    const b = draftFromReport({ store, presentation: 'otro', quantityG: 750, quality: 'primera' });
    expect(a.otherGrams).toBe('750');
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
  });
});
