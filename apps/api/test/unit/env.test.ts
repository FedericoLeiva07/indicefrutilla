import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5432/db', IP_HASH_SECRET: 's'.repeat(32) };

describe('loadEnv', () => {
  it('aplica los valores por defecto', () => {
    expect(loadEnv(base)).toMatchObject({
      PORT: 3000,
      TRUST_CLOUDFLARE: false,
      TRUST_PROXY_HOPS: 0,
    });
  });

  it('falla con un secreto de IP corto', () => {
    expect(() => loadEnv({ ...base, IP_HASH_SECRET: 'corto' })).toThrow(/IP_HASH_SECRET/);
  });
});
