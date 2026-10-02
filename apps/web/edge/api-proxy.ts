import type { ApiErrorBody } from '@indice/shared';

export const PROXY_SECRET_HEADER = 'x-proxy-secret';
export const CLIENT_IP_HEADER = 'x-client-ip';

export interface ProxyEnv {
  API_ORIGIN?: string;
  API_PROXY_SECRET?: string;
}

export type ProxyDecision =
  | { kind: 'reject'; status: number; body: ApiErrorBody }
  | { kind: 'forward'; url: URL; headers: Headers };

export function decideProxy(
  request: Request,
  env: ProxyEnv,
  clientIp: string | undefined,
): ProxyDecision {
  if (!env.API_ORIGIN || !env.API_PROXY_SECRET) {
    return {
      kind: 'reject',
      status: 503,
      body: { error: { code: 'INTERNAL', message: 'La API no está configurada' } },
    };
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return {
      kind: 'reject',
      status: 403,
      body: { error: { code: 'FORBIDDEN', message: 'Esta API solo responde a la web de Índice' } },
    };
  }

  const incoming = new URL(request.url);
  const url = new URL(`${incoming.pathname}${incoming.search}`, env.API_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete(CLIENT_IP_HEADER);
  headers.delete('cookie');
  headers.set(PROXY_SECRET_HEADER, env.API_PROXY_SECRET);
  if (clientIp) headers.set(CLIENT_IP_HEADER, clientIp);
  return { kind: 'forward', url, headers };
}
