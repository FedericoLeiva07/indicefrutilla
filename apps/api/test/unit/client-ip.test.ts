import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { clientIp, clientIpHeader, hashIp } from '../../src/modules/device/client-ip';

function req(ip: string, headers: Record<string, string> = {}): Request {
  return { ip, socket: {}, header: (n: string) => headers[n.toLowerCase()] } as unknown as Request;
}

describe('clientIp', () => {
  it('usa el header de confianza solo si está configurado', () => {
    const r = req('10.0.0.1', { 'cf-connecting-ip': '200.1.2.3', 'x-client-ip': '190.4.5.6' });
    expect(clientIp(r, 'cf-connecting-ip')).toBe('200.1.2.3');
    expect(clientIp(r, 'x-client-ip')).toBe('190.4.5.6');
    expect(clientIp(r, null)).toBe('10.0.0.1');
  });

  it('cae a req.ip si no viene el header', () => {
    expect(clientIp(req('10.0.0.1'), 'x-client-ip')).toBe('10.0.0.1');
  });
});

describe('clientIpHeader', () => {
  it('con el proxy de la web confía en x-client-ip; con Cloudflare, en CF-Connecting-IP', () => {
    expect(clientIpHeader({ PROXY_SECRET: 's'.repeat(32), TRUST_CLOUDFLARE: false })).toBe(
      'x-client-ip',
    );
    expect(clientIpHeader({ PROXY_SECRET: undefined, TRUST_CLOUDFLARE: true })).toBe(
      'cf-connecting-ip',
    );
    expect(clientIpHeader({ PROXY_SECRET: undefined, TRUST_CLOUDFLARE: false })).toBeNull();
  });
});

describe('hashIp', () => {
  it('es determinístico y depende de la clave', () => {
    const a = hashIp('200.1.2.3', 'x'.repeat(32));
    expect(a).toEqual(hashIp('200.1.2.3', 'x'.repeat(32)));
    expect(a).not.toEqual(hashIp('200.1.2.3', 'y'.repeat(32)));
    expect(a).toHaveLength(32);
  });
});
