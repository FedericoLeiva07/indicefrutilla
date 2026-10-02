import { ipAddress, rewrite } from '@vercel/functions';
import { decideProxy } from './edge/api-proxy';

export const config = { matcher: '/api/:path*' };

export default function middleware(request: Request): Response {
  const decision = decideProxy(request, process.env, ipAddress(request));
  if (decision.kind === 'reject') return Response.json(decision.body, { status: decision.status });
  return rewrite(decision.url, { request: { headers: decision.headers } });
}
