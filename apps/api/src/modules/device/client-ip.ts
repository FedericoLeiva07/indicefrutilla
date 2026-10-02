import { createHmac } from 'node:crypto';
import type { Request } from 'express';

export function clientIp(req: Request, trustCloudflare: boolean): string {
  const cf = trustCloudflare ? req.header('cf-connecting-ip') : undefined;
  return cf?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
}

export function hashIp(ip: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(ip).digest();
}
