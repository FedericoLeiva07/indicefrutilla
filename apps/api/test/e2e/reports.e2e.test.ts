import { randomUUID } from 'node:crypto';
import { argentinaDate, shiftDate, weekStart } from '@indice/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, FAILING_TURNSTILE_TOKEN } from './app';
import { CASEROS, insertStore, newDevice, resetDatabase, seedTresDeFebrero } from './fixtures';

async function seedReference(db: DataSource, modalPpk: number, daysAgo = 1): Promise<void> {
  await db.query(
    `INSERT INTO reference_prices (date, origin, package, kg, quality, size, min_ppk, modal_ppk, max_ppk, source_file)
     VALUES ($1, 'TUCUMAN', 'CA', 2, 'EL', 'GRANEL', $2, $3, $4, 'RF.XLS')`,
    [shiftDate(argentinaDate(), -daysAgo), modalPpk * 0.9, modalPpk, modalPpk * 1.1],
  );
}

describe('reports (e2e)', () => {
  let app: NestExpressApplication;
  let db: DataSource;
  let storeId: number;
  const today = argentinaDate();

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedTresDeFebrero(db);
    storeId = await insertStore(db, { name: 'Verdulería', ...CASEROS });
    await seedReference(db, 5000);
  });

  afterAll(async () => {
    await app?.close();
  });

  const api = () => request(app.getHttpServer());

  const createReport = (body: Record<string, unknown>, device = newDevice(), key?: string) => {
    const req = api()
      .post('/api/v1/reports')
      .set('X-Device-Id', device)
      .send({
        storeId,
        priceArs: 9200,
        presentation: 'cajon',
        quantityG: 2000,
        quality: 'primera',
        observedAt: today,
        turnstileToken: 'ok',
        ...body,
      });
    return key ? req.set('Idempotency-Key', key) : req;
  };

  it('crea la oferta activa con el $/kg normalizado (C6)', async () => {
    const device = newDevice();
    const res = await createReport({ reporterName: '  Fede  ' }, device).expect(201);
    expect(res.body).toEqual({
      report: { id: expect.any(Number), pricePerKg: 4600 },
      zone: { level: 'department', id: '06840', name: 'Tres de Febrero' },
      comparison: null,
    });
    const [row] = await db.query(
      `SELECT store_id, price_ars, presentation, quantity_g, price_per_kg, quality,
              to_char(observed_at, 'YYYY-MM-DD') AS observed_at, reporter_name, device_id, status
         FROM reports`,
    );
    expect(row).toEqual({
      store_id: storeId,
      price_ars: 9200,
      presentation: 'cajon',
      quantity_g: 2000,
      price_per_kg: 4600,
      quality: 'primera',
      observed_at: today,
      reporter_name: 'Fede',
      device_id: device,
      status: 'active',
    });
  });

  it('usa el peso fijo de la presentación e ignora quantityG', async () => {
    const res = await createReport({
      presentation: 'g500',
      priceArs: 2300.5,
      quantityG: 123,
    }).expect(201);
    expect(res.body.report.pricePerKg).toBe(4601);
  });

  it('recorta el nombre a 30 caracteres y trata el vacío como anónimo', async () => {
    await createReport({ reporterName: 'x'.repeat(40) }).expect(201);
    await createReport({ reporterName: '   ' }).expect(201);
    const rows = await db.query(`SELECT reporter_name FROM reports ORDER BY id`);
    expect(rows).toEqual([{ reporter_name: 'x'.repeat(30) }, { reporter_name: null }]);
  });

  it('compara contra el índice publicado de la zona', async () => {
    await db.query(
      `INSERT INTO price_index_weekly (week_start, level, zone_id, median_ppk, p25_ppk, p75_ppk,
                                       sample_size, store_count, published)
       VALUES ($1, 'department', '06840', 5200, 4800, 5600, 12, 5, true)`,
      [weekStart(today)],
    );
    const res = await createReport({}).expect(201);
    expect(res.body.comparison).toEqual({ zoneMedian: 5200, diffPct: -12 });
  });

  it('no compara contra un índice sin publicar', async () => {
    await db.query(
      `INSERT INTO price_index_weekly (week_start, level, zone_id, median_ppk, sample_size, store_count, published)
       VALUES ($1, 'department', '06840', 5200, 2, 1, false)`,
      [weekStart(today)],
    );
    const res = await createReport({}).expect(201);
    expect(res.body.comparison).toBeNull();
  });

  describe('validación (C3)', () => {
    const fieldErrors = (res: request.Response) => res.body.error.details;

    it('exige los kilos del cajón', async () => {
      const res = await createReport({ quantityG: undefined }).expect(400);
      expect(fieldErrors(res)).toEqual([{ field: 'quantityG', code: 'required' }]);
    });

    it('valida el rango de gramos según la presentación', async () => {
      const cajon = await createReport({ quantityG: 500 }).expect(400);
      expect(fieldErrors(cajon)).toEqual([{ field: 'quantityG', code: 'range' }]);
      const otro = await createReport({ presentation: 'otro', quantityG: 40 }).expect(400);
      expect(fieldErrors(otro)).toEqual([{ field: 'quantityG', code: 'range' }]);
      await createReport({ presentation: 'otro', quantityG: 50, priceArs: 250 }).expect(201);
    });

    it('acepta hoy, ayer y hace 2 días, pero no fechas futuras ni más viejas', async () => {
      await createReport({ observedAt: shiftDate(today, -2) }).expect(201);
      for (const observedAt of [shiftDate(today, 1), shiftDate(today, -3), '2026-13-01']) {
        const res = await createReport({ observedAt }).expect(400);
        expect(fieldErrors(res)).toEqual([{ field: 'observedAt', code: 'recentDate' }]);
      }
    });

    it('valida precio, presentación y calidad', async () => {
      const res = await createReport({
        priceArs: 10.123,
        presentation: 'bandeja',
        quality: 'tercera',
      }).expect(400);
      expect(
        fieldErrors(res)
          .map((d: { field: string }) => d.field)
          .sort(),
      ).toEqual(['presentation', 'priceArs', 'quality']);
    });
  });

  it('responde STORE_NOT_FOUND para un comercio inexistente', async () => {
    const res = await createReport({ storeId: 999999 }).expect(422);
    expect(res.body.error.code).toBe('STORE_NOT_FOUND');
  });

  it('responde TURNSTILE_FAILED con un token inválido (C11)', async () => {
    const res = await createReport({ turnstileToken: FAILING_TURNSTILE_TOKEN }).expect(403);
    expect(res.body.error.code).toBe('TURNSTILE_FAILED');
  });

  describe('rango plausible (C4)', () => {
    it('rechaza un $/kg por debajo de 0,7 × la referencia y no lo guarda', async () => {
      const res = await createReport({ priceArs: 6800 }).expect(422);
      expect(res.body.error).toMatchObject({
        code: 'PRICE_OUT_OF_RANGE',
        details: { plausibleMin: 3500, plausibleMax: 20000, pricePerKg: 3400 },
      });
      const [{ count }] = await db.query(`SELECT count(*)::int AS count FROM reports`);
      expect(count).toBe(0);
    });

    it('rechaza un $/kg por encima de 4 × la referencia', async () => {
      const res = await createReport({ priceArs: 40002 }).expect(422);
      expect(res.body.error.details.pricePerKg).toBe(20001);
    });

    it('usa el rango del entorno si la referencia tiene más de 14 días', async () => {
      await db.query(`TRUNCATE reference_prices`);
      await seedReference(db, 5000, 15);
      await createReport({ priceArs: 2200 }).expect(201);
      const res = await createReport({ priceArs: 900, presentation: 'kg1' }).expect(422);
      expect(res.body.error.details).toMatchObject({ plausibleMin: 1000, plausibleMax: 50000 });
    });
  });

  describe('idempotencia', () => {
    it('reintentar con la misma clave y otro token devuelve la misma oferta (C12)', async () => {
      const device = newDevice();
      const key = randomUUID();
      const first = await createReport({}, device, key).expect(201);
      const retry = await createReport({ turnstileToken: 'nuevo' }, device, key).expect(201);
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.body).toEqual(first.body);
      const [{ count }] = await db.query(`SELECT count(*)::int AS count FROM reports`);
      expect(count).toBe(1);
    });

    it('un error no consume la clave', async () => {
      const device = newDevice();
      const key = randomUUID();
      await createReport({ turnstileToken: FAILING_TURNSTILE_TOKEN }, device, key).expect(403);
      await createReport({}, device, key).expect(201);
    });

    it('responde IDEMPOTENCY_CONFLICT con otro cuerpo o desde otro dispositivo', async () => {
      const device = newDevice();
      const key = randomUUID();
      await createReport({}, device, key).expect(201);
      const otherBody = await createReport({ priceArs: 9300 }, device, key).expect(409);
      expect(otherBody.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
      const otherDevice = await createReport({}, newDevice(), key).expect(409);
      expect(otherDevice.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('resuelve dos envíos simultáneos con la misma clave en una sola oferta', async () => {
      const device = newDevice();
      const key = randomUUID();
      const [a, b] = await Promise.all([
        createReport({}, device, key),
        createReport({ turnstileToken: 'otro' }, device, key),
      ]);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(a.body.report.id).toBe(b.body.report.id);
    });

    it('valida el formato de la clave', async () => {
      const res = await createReport({}, newDevice(), 'no-es-uuid').expect(400);
      expect(res.body.error.details).toEqual([{ field: 'Idempotency-Key', code: 'isUuid' }]);
    });
  });

  it('limita a 20 ofertas por dispositivo por día (C10)', async () => {
    const device = newDevice();
    await db.query(
      `INSERT INTO reports (store_id, price_ars, presentation, quantity_g, price_per_kg, quality,
                            observed_at, device_id, ip_hash)
       SELECT $1, 5000, 'kg1', 1000, 5000, 'primera', $2, $3, '\\x01' FROM generate_series(1, 19)`,
      [storeId, today, device],
    );
    await createReport({}, device).expect(201);
    const res = await createReport({}, device).expect(429);
    expect(res.body.error.code).toBe('DAILY_LIMIT_REACHED');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('limita a 40 ofertas por IP por día', async () => {
    await db.query(
      `INSERT INTO reports (store_id, price_ars, presentation, quantity_g, price_per_kg, quality,
                            observed_at, device_id, ip_hash)
       SELECT $1, 5000, 'kg1', 1000, 5000, 'primera', $2, gen_random_uuid(), $3
         FROM generate_series(1, 40)`,
      [storeId, today, await ipHashOfTestClient()],
    );
    const res = await createReport({}).expect(429);
    expect(res.body.error.code).toBe('DAILY_LIMIT_REACHED');
  });

  async function ipHashOfTestClient(): Promise<Buffer> {
    await createReport({}).expect(201);
    const [{ ip_hash }] = await db.query(`SELECT ip_hash FROM reports ORDER BY id DESC LIMIT 1`);
    await db.query(`DELETE FROM reports`);
    return ip_hash;
  }
});
