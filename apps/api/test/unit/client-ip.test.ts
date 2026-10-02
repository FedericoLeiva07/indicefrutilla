import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { clientIp, hashIp } from '../../src/modules/device/client-ip';

function req(ip: string, headers: Record<string, string> = {}): Request {
  return { ip, socket: {}, header: (n: string) => headers[n.toLowerCase()] } as unknown as Request;
}

describe('clientIp', () => {
  it('usa CF-Connecting-IP solo si se confía en Cloudflare', () => {
    const r = req('10.0.0.1', { 'cf-connecting-ip': '200.1.2.3' });
    expect(clientIp(r, true)).toBe('200.1.2.3');
    expect(clientIp(r, false)).toBe('10.0.0.1');
  });

  it('cae a req.ip si no viene el header', () => {
    expect(clientIp(req('10.0.0.1'), true)).toBe('10.0.0.1');
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
