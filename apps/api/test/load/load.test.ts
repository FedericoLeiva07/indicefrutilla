import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { argentinaDate } from '@indice/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../e2e/app';
import { resetDatabase, seedTresDeFebrero } from '../e2e/fixtures';

const STORES = 200;
const REPORTS_PER_STORE = 10;
const READS = 3_000;
const CONCURRENCY = 50;

interface Result {
  status: number;
  ms: number;
  code?: string;
  retryAfter?: string | null;
}

const RUN_PREFIX = 11 + Math.floor(Math.random() * 200);
let ipCounter = 0;
const nextIp = () => {
  ipCounter += 1;
  return `${RUN_PREFIX}.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
};

async function call(
  base: string,
  path: string,
  init: RequestInit & { ip?: string } = {},
): Promise<Result> {
  const started = performance.now();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': init.ip ?? nextIp(),
      ...(init.headers ?? {}),
    },
  });
  const ms = performance.now() - started;
  const text = await res.text();
  let code: string | undefined;
  try {
    code = (JSON.parse(text) as { error?: { code?: string } }).error?.code;
  } catch {
    code = undefined;
  }
  return { status: res.status, ms, code, retryAfter: res.headers.get('retry-after') };
}

async function pool<T>(
  total: number,
  concurrency: number,
  task: (i: number) => Promise<T>,
): Promise<T[]> {
  const results: T[] = new Array(total);
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < total) {
        const i = next++;
        results[i] = await task(i);
      }
    }),
  );
  return results;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!);
}

function serve(app: NestExpressApplication): Promise<string> {
  return new Promise((resolve) => {
    const server = app.getHttpServer().listen(0, () => {
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`);
    });
  });
}

describe('carga y límites', () => {
  let throttled: NestExpressApplication;
  let open: NestExpressApplication;
  let throttledUrl: string;
  let openUrl: string;
  let reportId: number;
  let storeId: number;

  beforeAll(async () => {
    const redis: Record<string, string> = process.env.TEST_REDIS_URL
      ? { REDIS_URL: process.env.TEST_REDIS_URL }
      : {};
    throttled = await createTestApp({
      THROTTLE_ENABLED: 'true',
      TRUST_CLOUDFLARE: 'true',
      ...redis,
    });
    open = await createTestApp({ THROTTLE_ENABLED: 'false', TRUST_CLOUDFLARE: 'true' });
    const db = throttled.get(DataSource);
    await resetDatabase(db);
    await seedTresDeFebrero(db);
    await db.query(
      `INSERT INTO stores (name, name_normalized, address, location, province_id, department_id, created_by_device, created_ip_hash)
       SELECT 'Comercio ' || g, 'comercio ' || g, 'Calle ' || g,
              ST_SetSRID(ST_MakePoint(-58.59 + random() * 0.04, -34.615 + random() * 0.04), 4326)::geography,
              '06', '06840', gen_random_uuid(), '\\x00'
         FROM generate_series(1, $1) g`,
      [STORES],
    );
    await db.query(
      `INSERT INTO reports (store_id, price_ars, presentation, quantity_g, price_per_kg, quality, observed_at, device_id, ip_hash)
       SELECT s.id, p, 'kg1', 1000, p, 'primera', $2::date - (g % 7), gen_random_uuid(), '\\x00'
         FROM stores s, generate_series(1, $1) g, LATERAL (SELECT 3000 + (random() * 4000)::int AS p) price`,
      [REPORTS_PER_STORE, argentinaDate()],
    );
    await db.query('ANALYZE');
    [{ id: reportId, store_id: storeId }] = await db.query(
      `SELECT id, store_id FROM reports ORDER BY id LIMIT 1`,
    );
    throttledUrl = await serve(throttled);
    openUrl = await serve(open);
  });

  afterAll(async () => {
    await throttled?.close();
    await open?.close();
  });

  it(`sostiene ${READS} lecturas con ${CONCURRENCY} conexiones concurrentes`, async () => {
    const paths = [
      '/reports?lat=-34.6&lng=-58.57&radius=3000&sort=price',
      '/reports?lat=-34.6&lng=-58.57&radius=5000&sort=distance',
      '/index/summary?departmentId=06840',
      '/stores/nearby?lat=-34.6&lng=-58.57',
    ];
    const started = performance.now();
    const results = await pool(READS, CONCURRENCY, (i) =>
      call(throttledUrl, paths[i % paths.length]!),
    );
    const seconds = (performance.now() - started) / 1000;
    const ms = results.map((r) => r.ms);
    const errors = results.filter((r) => r.status !== 200);
    const report = {
      requests: READS,
      rps: Math.round(READS / seconds),
      p50: percentile(ms, 50),
      p95: percentile(ms, 95),
      p99: percentile(ms, 99),
      errors: errors.length,
    };
    console.log('Lecturas', JSON.stringify(report));
    expect(errors).toEqual([]);
    expect(report.p95).toBeLessThan(500);
  });

  it('una IP no pasa de 5 requests por segundo aunque lleguen juntas', async () => {
    const ip = nextIp();
    const results = await pool(20, 20, () => call(throttledUrl, '/health', { ip }));
    const ok = results.filter((r) => r.status === 200).length;
    const limited = results.filter((r) => r.code === 'RATE_LIMITED');
    console.log('Ráfaga por IP', JSON.stringify({ ok, limited: limited.length }));
    expect(ok).toBe(5);
    expect(limited).toHaveLength(15);
    expect(limited.every((r) => r.retryAfter === '1')).toBe(true);
  });

  it('un dispositivo no pasa de 5 escrituras por minuto desde IPs distintas', async () => {
    const device = randomUUID();
    const results = await pool(12, 12, () =>
      call(throttledUrl, `/reports/${reportId}/votes`, {
        method: 'POST',
        headers: { 'X-Device-Id': device },
        body: JSON.stringify({ value: 1 }),
      }),
    );
    const passed = results.filter((r) => r.code !== 'RATE_LIMITED').length;
    console.log('Escrituras por dispositivo', JSON.stringify({ passed, limited: 12 - passed }));
    expect(passed).toBe(5);
  });

  it('una IP no pasa de 10 escrituras por minuto con dispositivos distintos', async () => {
    const ip = nextIp();
    const results: Result[] = [];
    for (let batch = 0; batch < 3; batch++) {
      if (batch > 0) await new Promise((r) => setTimeout(r, 1_100));
      results.push(
        ...(await pool(5, 5, () =>
          call(throttledUrl, `/reports/${reportId}/votes`, {
            method: 'POST',
            ip,
            headers: { 'X-Device-Id': randomUUID() },
            body: JSON.stringify({ value: 1 }),
          }),
        )),
      );
    }
    const passed = results.filter((r) => r.code !== 'RATE_LIMITED').length;
    console.log('Escrituras por IP', JSON.stringify({ passed, limited: results.length - passed }));
    expect(passed).toBe(10);
  });

  it('el límite diario aguanta envíos concurrentes del mismo dispositivo', async () => {
    const device = randomUUID();
    const today = argentinaDate();
    const results = await pool(30, 30, () =>
      call(openUrl, '/reports', {
        method: 'POST',
        headers: { 'X-Device-Id': device },
        body: JSON.stringify({
          storeId,
          priceArs: 5000,
          presentation: 'kg1',
          quality: 'primera',
          observedAt: today,
          turnstileToken: 'ok',
        }),
      }),
    );
    const created = results.filter((r) => r.status === 201).length;
    const limited = results.filter((r) => r.code === 'DAILY_LIMIT_REACHED').length;
    console.log('Límite diario concurrente', JSON.stringify({ created, limited }));
    expect(created).toBe(20);
    expect(limited).toBe(10);
  });
});
