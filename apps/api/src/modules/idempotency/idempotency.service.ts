import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@indice/shared';
import { DataSource, type EntityManager, QueryFailedError } from 'typeorm';
import { AppException } from '../../common/app-exception';

const TTL = `interval '24 hours'`;

export interface IdempotencyScope {
  key: string | undefined;
  deviceId: string;
  requestHash: Buffer;
}

export interface StoredResponse<T> {
  statusCode: number;
  body: T;
  replayed: boolean;
}

interface Row {
  device_id: string;
  request_hash: Buffer;
  status_code: number;
  response: unknown;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly dataSource: DataSource) {}

  static hash(scope: string, body: object): Buffer {
    return createHash('sha256').update(scope).update('\n').update(stableJson(body)).digest();
  }

  async replay<T>(scope: IdempotencyScope): Promise<StoredResponse<T> | null> {
    return this.find<T>(this.dataSource.manager, scope);
  }

  async run<T>(
    scope: IdempotencyScope,
    statusCode: number,
    work: (em: EntityManager) => Promise<T>,
  ): Promise<StoredResponse<T>> {
    try {
      return await this.dataSource.transaction(async (em) => {
        await em.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [scope.deviceId]);
        const previous = await this.find<T>(em, scope);
        if (previous) return previous;
        const body = await work(em);
        if (scope.key) await this.save(em, scope, statusCode, body);
        return { statusCode, body, replayed: false };
      });
    } catch (err) {
      if (scope.key && isKeyCollision(err)) {
        const previous = await this.replay<T>(scope);
        if (previous) return previous;
      }
      throw err;
    }
  }

  async purgeExpired(): Promise<number> {
    const [, count]: [unknown, number] = await this.dataSource.query(
      `DELETE FROM idempotency_keys WHERE created_at <= now() - ${TTL}`,
    );
    return count;
  }

  private async find<T>(
    em: EntityManager,
    scope: IdempotencyScope,
  ): Promise<StoredResponse<T> | null> {
    if (!scope.key) return null;
    const rows: Row[] = await em.query(
      `SELECT device_id, request_hash, status_code, response
         FROM idempotency_keys
        WHERE key = $1 AND created_at > now() - ${TTL}`,
      [scope.key],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.device_id !== scope.deviceId || !row.request_hash.equals(scope.requestHash)) {
      throw new AppException(
        ErrorCode.IdempotencyConflict,
        409,
        'Esta clave de idempotencia ya se usó con otros datos',
      );
    }
    return { statusCode: row.status_code, body: row.response as T, replayed: true };
  }

  private async save(
    em: EntityManager,
    scope: IdempotencyScope,
    statusCode: number,
    body: unknown,
  ): Promise<void> {
    await em.query(`DELETE FROM idempotency_keys WHERE key = $1 AND created_at <= now() - ${TTL}`, [
      scope.key,
    ]);
    await em.query(
      `INSERT INTO idempotency_keys (key, device_id, request_hash, status_code, response)
       VALUES ($1, $2, $3, $4, $5)`,
      [scope.key, scope.deviceId, scope.requestHash, statusCode, JSON.stringify(body)],
    );
  }
}

function isKeyCollision(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const driverError = err.driverError as { code?: string; constraint?: string };
  return driverError.code === '23505' && driverError.constraint === 'idempotency_keys_pkey';
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
