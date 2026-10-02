import { describe, expect, it } from 'vitest';
import { proxySecretMatches } from '../../src/modules/edge/domain/proxy-secret';

describe('proxySecretMatches', () => {
  const secret = 's'.repeat(40);

  it('acepta solo el secreto exacto', () => {
    expect(proxySecretMatches(secret, secret)).toBe(true);
    expect(proxySecretMatches(`${secret}x`, secret)).toBe(false);
    expect(proxySecretMatches('otro', secret)).toBe(false);
    expect(proxySecretMatches('', secret)).toBe(false);
  });

  it('rechaza si no viene el header', () => {
    expect(proxySecretMatches(undefined, secret)).toBe(false);
  });
});
