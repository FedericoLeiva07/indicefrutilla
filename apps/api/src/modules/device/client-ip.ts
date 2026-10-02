import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import type { Env } from '../../config/env';

export const PROXY_CLIENT_IP_HEADER = 'x-client-ip';

export function clientIpHeader(env: Pick<Env, 'PROXY_SECRET' | 'TRUST_CLOUDFLARE'>): string | null {
  if (env.PROXY_SECRET) return PROXY_CLIENT_IP_HEADER;
  if (env.TRUST_CLOUDFLARE) return 'cf-connecting-ip';
  return null;
}

export function clientIp(req: Request, trustedHeader: string | null): string {
  const forwarded = trustedHeader ? req.header(trustedHeader) : undefined;
  return forwarded?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
}

export function hashIp(ip: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(ip).digest();
}
