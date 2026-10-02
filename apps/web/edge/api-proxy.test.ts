import { describe, expect, it } from 'vitest';
import { decideProxy } from './api-proxy';

const env = { API_ORIGIN: 'https://api.up.railway.app', API_PROXY_SECRET: 's'.repeat(40) };

function req(path: string, headers: Record<string, string> = {}) {
  return new Request(`https://indice.example${path}`, { headers });
}

describe('decideProxy', () => {
  it('reenvía a la API con el secreto, la IP real y la misma ruta', () => {
    const decision = decideProxy(
      req('/api/v1/reports?lat=-34.6&lng=-58.5', {
        'sec-fetch-site': 'same-origin',
        'x-device-id': 'abc',
      }),
      env,
      '190.1.2.3',
    );
    expect(decision.kind).toBe('forward');
    if (decision.kind !== 'forward') return;
    expect(decision.url.toString()).toBe(
      'https://api.up.railway.app/api/v1/reports?lat=-34.6&lng=-58.5',
    );
    expect(decision.headers.get('x-proxy-secret')).toBe(env.API_PROXY_SECRET);
    expect(decision.headers.get('x-client-ip')).toBe('190.1.2.3');
    expect(decision.headers.get('x-device-id')).toBe('abc');
  });

  it('no deja que el navegador elija la IP ni mande cookies', () => {
    const decision = decideProxy(
      req('/api/v1/health', { 'x-client-ip': '1.1.1.1', cookie: 'a=b' }),
      env,
      undefined,
    );
    if (decision.kind !== 'forward') throw new Error('esperaba forward');
    expect(decision.headers.get('x-client-ip')).toBeNull();
    expect(decision.headers.get('cookie')).toBeNull();
  });

  it('rechaza pedidos desde otros sitios', () => {
    const decision = decideProxy(
      req('/api/v1/reports', { 'sec-fetch-site': 'cross-site' }),
      env,
      '190.1.2.3',
    );
    expect(decision).toMatchObject({
      kind: 'reject',
      status: 403,
      body: { error: { code: 'FORBIDDEN' } },
    });
  });

  it('falla cerrado si falta la configuración', () => {
    expect(
      decideProxy(req('/api/v1/health'), { API_ORIGIN: env.API_ORIGIN }, '190.1.2.3'),
    ).toMatchObject({ kind: 'reject', status: 503 });
  });
});
