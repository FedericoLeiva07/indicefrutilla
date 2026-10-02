import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';
import { ReferenceService } from '../../src/modules/reference/application/reference.service';
import type { ReferenceQueries } from '../../src/modules/reference/infra/reference.queries';

const env = loadEnv({
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  IP_HASH_SECRET: 's'.repeat(32),
  TURNSTILE_SECRET_KEY: 't',
  PLAUSIBLE_MIN_PPK: '2000',
  PLAUSIBLE_MAX_PPK: '100000',
});

const service = (current: { date: string; modalPpk: number } | null) =>
  new ReferenceService({ current: async () => current } as ReferenceQueries, env);

const now = new Date('2026-10-01T15:00:00Z');

describe('ReferenceService.latest', () => {
  it('deriva el rango plausible de la referencia vigente', async () => {
    expect(await service({ date: '2026-09-30', modalPpk: 4183.333 }).latest(now)).toEqual({
      date: '2026-09-30',
      modalPpk: 4183.33,
      plausibleMin: 2928.33,
      plausibleMax: 16733.32,
      source: 'Mercado Central de Buenos Aires',
    });
  });

  it('acepta una referencia de hasta 14 días', async () => {
    expect(
      (await service({ date: '2026-09-17', modalPpk: 5000 }).latest(now)).source,
    ).not.toBeNull();
  });

  it('usa el entorno con una referencia de más de 14 días o sin datos', async () => {
    const fallback = {
      date: null,
      modalPpk: null,
      plausibleMin: 2000,
      plausibleMax: 100000,
      source: null,
    };
    expect(await service({ date: '2026-09-16', modalPpk: 5000 }).latest(now)).toEqual(fallback);
    expect(await service(null).latest(now)).toEqual(fallback);
  });
});
