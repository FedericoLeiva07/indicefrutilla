import { describe, expect, it } from 'vitest';
import { createValidationPipe } from '../../src/common/validation';
import { AppException } from '../../src/common/app-exception';
import { CreateReportDto } from '../../src/modules/reports/api/reports.dto';
import { isRecentObservedAt } from '../../src/modules/reports/api/report.validators';

const pipe = createValidationPipe();
const valid = {
  storeId: 1,
  priceArs: 9200,
  presentation: 'cajon',
  quantityG: 2000,
  quality: 'primera',
  observedAt: new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date()),
  turnstileToken: 't',
};

async function errors(body: Record<string, unknown>) {
  try {
    await pipe.transform(body, { type: 'body', metatype: CreateReportDto });
    return [];
  } catch (err) {
    return (err as AppException).toBody().error.details;
  }
}

describe('CreateReportDto', () => {
  it('acepta un cuerpo válido', async () => {
    expect(await errors(valid)).toEqual([]);
  });

  it('pide quantityG solo para cajón y otro', async () => {
    expect(await errors({ ...valid, quantityG: undefined })).toEqual([
      { field: 'quantityG', code: 'required' },
    ]);
    expect(await errors({ ...valid, presentation: 'otro', quantityG: null })).toEqual([
      { field: 'quantityG', code: 'required' },
    ]);
    expect(await errors({ ...valid, presentation: 'kg1', quantityG: undefined })).toEqual([]);
  });

  it('valida gramos enteros dentro del rango', async () => {
    expect(await errors({ ...valid, quantityG: 1500.5 })).toEqual([
      { field: 'quantityG', code: 'range' },
    ]);
    expect(await errors({ ...valid, quantityG: 10001 })).toEqual([
      { field: 'quantityG', code: 'range' },
    ]);
    expect(await errors({ ...valid, presentation: 'otro', quantityG: 50 })).toEqual([]);
  });

  it('valida el precio', async () => {
    expect(await errors({ ...valid, priceArs: 0.5 })).toEqual([{ field: 'priceArs', code: 'min' }]);
    expect(await errors({ ...valid, priceArs: 10_000_001 })).toEqual([
      { field: 'priceArs', code: 'max' },
    ]);
    expect(await errors({ ...valid, priceArs: '9200' })).toHaveLength(1);
    expect(await errors({ ...valid, priceArs: 9200.25 })).toEqual([]);
  });

  it('rechaza campos desconocidos', async () => {
    expect(await errors({ ...valid, photoUrl: 'x' })).toEqual([
      { field: 'photoUrl', code: 'whitelistValidation' },
    ]);
  });
});

describe('isRecentObservedAt', () => {
  const now = new Date('2026-10-02T01:00:00Z');

  it('usa el día de Argentina', () => {
    expect(isRecentObservedAt('2026-10-01', now)).toBe(true);
    expect(isRecentObservedAt('2026-10-02', now)).toBe(false);
    expect(isRecentObservedAt('2026-09-29', now)).toBe(true);
    expect(isRecentObservedAt('2026-09-28', now)).toBe(false);
  });
});
