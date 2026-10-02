import { ARGENTINA_TZ, ErrorCode } from '@indice/shared';
import type { EntityManager } from 'typeorm';
import { AppException } from './app-exception';

export interface DailyLimitSpec {
  table: 'reports' | 'stores';
  deviceColumn: string;
  ipColumn: string;
  perDevice: number;
  perIp: number;
  message: string;
}

export const REPORTS_DAILY_LIMIT: DailyLimitSpec = {
  table: 'reports',
  deviceColumn: 'device_id',
  ipColumn: 'ip_hash',
  perDevice: 20,
  perIp: 40,
  message: 'Llegaste al límite de precios cargados por hoy',
};

export const STORES_DAILY_LIMIT: DailyLimitSpec = {
  table: 'stores',
  deviceColumn: 'created_by_device',
  ipColumn: 'created_ip_hash',
  perDevice: 5,
  perIp: 10,
  message: 'Llegaste al límite de comercios nuevos por hoy',
};

export async function assertDailyLimit(
  em: EntityManager,
  spec: DailyLimitSpec,
  deviceId: string,
  ipHash: Buffer,
): Promise<void> {
  const [row]: Array<{ device_count: number; ip_count: number; reset_in: number }> = await em.query(
    `WITH today AS (
         SELECT date_trunc('day', now() AT TIME ZONE $3) AS local_start
       )
       SELECT count(*) FILTER (WHERE t.${spec.deviceColumn} = $1)::int AS device_count,
              count(*) FILTER (WHERE t.${spec.ipColumn} = $2)::int AS ip_count,
              ceil(extract(epoch FROM ((today.local_start + interval '1 day') AT TIME ZONE $3) - now()))::int AS reset_in
         FROM today
         LEFT JOIN ${spec.table} t
           ON (t.${spec.deviceColumn} = $1 OR t.${spec.ipColumn} = $2)
          AND t.created_at >= today.local_start AT TIME ZONE $3
        GROUP BY today.local_start`,
    [deviceId, ipHash, ARGENTINA_TZ],
  );
  if (!row) return;
  if (row.device_count >= spec.perDevice || row.ip_count >= spec.perIp) {
    throw new AppException(
      ErrorCode.DailyLimitReached,
      429,
      spec.message,
      undefined,
      Math.max(1, row.reset_in),
    );
  }
}
