import type { Response } from 'express';
import type { StoredResponse } from './idempotency.service';

export function sendStored<T>(res: Response, result: StoredResponse<T>): T {
  res.status(result.statusCode);
  if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
  return result.body;
}
