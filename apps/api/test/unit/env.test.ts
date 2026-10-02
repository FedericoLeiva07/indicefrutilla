import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  IP_HASH_SECRET: 's'.repeat(32),
  TURNSTILE_SECRET_KEY: 'secret',
};

describe('loadEnv', () => {
  it('aplica los valores por defecto', () => {
    expect(loadEnv(base)).toMatchObject({
      PORT: 3000,
      TRUST_CLOUDFLARE: false,
      TRUST_PROXY_HOPS: 0,
      THROTTLE_ENABLED: true,
      PLAUSIBLE_MIN_PPK: 2000,
      PLAUSIBLE_MAX_PPK: 100000,
    });
  });

  it('falla con un secreto de IP corto', () => {
    expect(() => loadEnv({ ...base, IP_HASH_SECRET: 'corto' })).toThrow(/IP_HASH_SECRET/);
  });

  it('exige el secreto de Turnstile', () => {
    expect(() => loadEnv({ ...base, TURNSTILE_SECRET_KEY: undefined })).toThrow(
      /TURNSTILE_SECRET_KEY/,
    );
  });

  it('exige un rango plausible de respaldo coherente', () => {
    expect(() =>
      loadEnv({ ...base, PLAUSIBLE_MIN_PPK: '5000', PLAUSIBLE_MAX_PPK: '4000' }),
    ).toThrow(/PLAUSIBLE_MIN_PPK/);
  });
});
