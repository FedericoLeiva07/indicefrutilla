import { createHash, timingSafeEqual } from 'node:crypto';

export const PROXY_SECRET_HEADER = 'x-proxy-secret';

const digest = (value: string) => createHash('sha256').update(value).digest();

export function proxySecretMatches(received: string | undefined, expected: string): boolean {
  return received !== undefined && timingSafeEqual(digest(received), digest(expected));
}
