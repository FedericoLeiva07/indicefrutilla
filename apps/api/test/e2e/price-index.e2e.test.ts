import { argentinaDate, shiftDate, weekStart } from '@indice/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PriceIndexService } from '../../src/modules/price-index/application/price-index.service';
import { createTestApp } from './app';
import { insertReport, insertStore, resetDatabase, seedTresDeFebrero } from './fixtures';

describe('price index (e2e)', () => {
  let app: NestExpressApplication;
  let db: DataSource;
  const today = argentinaDate();
  const current = weekStart(today);
  const previous = shiftDate(current, -7);

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedTresDeFebrero(db);
  });

  afterAll(async () => {
    await app?.close();
  });

  const api = () => request(app.getHttpServer());
  const recompute = () => app.get(PriceIndexService).recomputeRecent();

  async function stores(n: number): Promise<number[]> {
    const ids: number[] = [];
    for (let i = 0; i < n; i++) {
      ids.push(
        await insertStore(db, { name: `Comercio ${i}`, lat: -34.6 - i * 0.001, lng: -58.56 }),
      );
    }
    return ids;
  }

  it('calcula la mediana de las medianas por comercio y publica con 5 ofertas y 3 comercios', async () => {
    const [a, b, c] = await stores(3);
    await insertReport(db, { storeId: a!, pricePerKg: 4000, observedAt: current });
    await insertReport(db, { storeId: a!, pricePerKg: 4000, observedAt: current });
    await insertReport(db, { storeId: a!, pricePerKg: 4000, observedAt: current });
    await insertReport(db, { storeId: b!, pricePerKg: 5000, observedAt: current });
    await insertReport(db, { storeId: c!, pricePerKg: 6000, observedAt: current });
    await insertReport(db, {
      storeId: c!,
      pricePerKg: 1000,
      observedAt: current,
      quality: 'segunda',
    });
    await insertReport(db, {
      storeId: c!,
      pricePerKg: 1000,
      observedAt: current,
      status: 'flagged',
    });
    await recompute();

    const rows = await db.query(
      `SELECT level, zone_id, median_ppk, p25_ppk, p75_ppk, sample_size, store_count, published
         FROM price_index_weekly WHERE week_start = $1 ORDER BY level`,
      [current],
    );
    const expected = {
      median_ppk: 5000,
      p25_ppk: 4500,
      p75_ppk: 5500,
      sample_size: 5,
      store_count: 3,
      published: true,
    };
    expect(rows).toEqual([
      { level: 'department', zone_id: '06840', ...expected },
      { level: 'province', zone_id: '06', ...expected },
      { level: 'country', zone_id: 'AR', ...expected },
    ]);
  });

  it('no publica con menos de 3 comercios', async () => {
    const [a, b] = await stores(2);
    for (let i = 0; i < 4; i++)
      await insertReport(db, { storeId: a!, pricePerKg: 5000, observedAt: current });
    await insertReport(db, { storeId: b!, pricePerKg: 5000, observedAt: current });
    await recompute();
    const [row] = await db.query(
      `SELECT published FROM price_index_weekly WHERE level = 'country'`,
    );
    expect(row.published).toBe(false);
  });

  it('una oferta que ya no está vigente sigue contando en su semana', async () => {
    const ids = await stores(5);
    for (const id of ids)
      await insertReport(db, { storeId: id, pricePerKg: 5000, observedAt: shiftDate(previous, 0) });
    await recompute();
    const [row] = await db.query(
      `SELECT published, sample_size FROM price_index_weekly WHERE week_start = $1 AND level = 'country'`,
      [previous],
    );
    expect(row).toEqual({ published: true, sample_size: 5 });
  });

  describe('GET /index/summary', () => {
    it('muestra el primer nivel publicado con su historia y la variación semanal', async () => {
      await db.query(
        `INSERT INTO price_index_weekly (week_start, level, zone_id, median_ppk, p25_ppk, p75_ppk, sample_size, store_count, published)
         VALUES ($1, 'department', '06840', NULL, NULL, NULL, 2, 1, false),
                ($1, 'province', '06', 5200, 4400, 6100, 38, 12, true),
                ($2, 'province', '06', 5000, 4300, 6000, 30, 10, true),
                ($1, 'country', 'AR', 5300, 4500, 6200, 120, 40, true)`,
        [current, previous],
      );
      const res = await api()
        .get('/api/v1/index/summary')
        .query({ departmentId: '06840' })
        .expect(200);
      expect(res.body.weekStart).toBe(current);
      expect(res.body.levels).toEqual([
        {
          level: 'department',
          id: '06840',
          name: 'Tres de Febrero',
          published: false,
          medianPpk: null,
          p25Ppk: null,
          p75Ppk: null,
          sampleSize: 2,
          storeCount: 1,
          weeklyChangePct: null,
        },
        {
          level: 'province',
          id: '06',
          name: 'Buenos Aires',
          published: true,
          medianPpk: 5200,
          p25Ppk: 4400,
          p75Ppk: 6100,
          sampleSize: 38,
          storeCount: 12,
          weeklyChangePct: 4,
        },
        expect.objectContaining({
          level: 'country',
          id: 'AR',
          name: 'Argentina',
          weeklyChangePct: null,
        }),
      ]);
      expect(res.body.shown.level).toBe('province');
      expect(res.body.history).toHaveLength(8);
      expect(res.body.history.slice(-2)).toEqual([
        { weekStart: previous, medianPpk: 5000 },
        { weekStart: current, medianPpk: 5200 },
      ]);
      expect(res.body.history[0]).toEqual({ weekStart: shiftDate(current, -49), medianPpk: null });
      expect(res.body.reference).toMatchObject({ plausibleMin: 1000, plausibleMax: 50000 });
    });

    it('cae a la referencia mayorista sin ningún nivel publicado', async () => {
      await db.query(
        `INSERT INTO reference_prices (date, origin, package, kg, quality, size, min_ppk, modal_ppk, max_ppk, source_file)
         VALUES ($1, 'TUCUMAN', 'CA', 2, 'EL', 'GRANEL', 4000, 4500, 5000, 'RF.XLS'),
                ($2, 'TUCUMAN', 'CA', 2, 'EL', 'GRANEL', 5000, 5500, 6000, 'RF.XLS')`,
        [today, shiftDate(current, -1)],
      );
      const res = await api().get('/api/v1/index/summary').query({ provinceId: '06' }).expect(200);
      expect(res.body.shown).toBeNull();
      expect(res.body.levels.map((l: { level: string }) => l.level)).toEqual([
        'province',
        'country',
      ]);
      expect(res.body.reference).toMatchObject({
        modalPpk: 5000,
        source: 'Mercado Central de Buenos Aires',
      });
      expect(res.body.history.slice(-2)).toEqual([
        { weekStart: previous, medianPpk: 5500 },
        { weekStart: current, medianPpk: 4500 },
      ]);
    });

    it('responde NOT_FOUND para una zona inexistente', async () => {
      await api().get('/api/v1/index/summary').query({ departmentId: '99999' }).expect(404);
    });
  });
});

describe('price index windows (e2e)', () => {
  let app: NestExpressApplication;
  let db: DataSource;
  const current = weekStart(argentinaDate());

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    await resetDatabase(db);
    await seedTresDeFebrero(db);
    await db.query(
      `INSERT INTO provinces (id, name, centroid)
       VALUES ('90', 'Tucumán', ST_SetSRID(ST_MakePoint(-65.2, -26.8), 4326)::geography)`,
    );
    const stores: number[] = [];
    for (let i = 0; i < 3; i++) {
      stores.push(
        await insertStore(db, { name: `Comercio ${i}`, lat: -34.6 - i * 0.001, lng: -58.56 }),
      );
    }
    for (const [i, id] of stores.entries()) {
      for (let copy = 0; copy < 2; copy++) {
        await insertReport(db, { storeId: id, pricePerKg: 5000 + i * 1000, observedAt: current });
        await insertReport(db, {
          storeId: id,
          pricePerKg: 4000 + i * 1000,
          observedAt: shiftDate(current, -7),
        });
      }
      await insertReport(db, {
        storeId: id,
        pricePerKg: 3000,
        observedAt: shiftDate(current, -21),
      });
    }
    await app.get(PriceIndexService).recomputeRecent();
  });

  afterAll(async () => {
    await app?.close();
  });

  const api = () => request(app.getHttpServer());

  it('lista las provincias de la semana con variación y las sin datos al final (D3)', async () => {
    const res = await api().get('/api/v1/index/provinces').expect(200);
    expect(res.body).toMatchObject({ weeks: 1, from: current, to: shiftDate(current, 6) });
    expect(res.body.country).toMatchObject({
      published: true,
      medianPpk: 6000,
      weeklyChangePct: 20,
    });
    expect(res.body.provinces).toEqual([
      {
        provinceId: '06',
        name: 'Buenos Aires',
        published: true,
        medianPpk: 6000,
        p25Ppk: 5500,
        p75Ppk: 6500,
        sampleSize: 6,
        storeCount: 3,
        weeklyChangePct: 20,
      },
      {
        provinceId: '90',
        name: 'Tucumán',
        published: false,
        medianPpk: null,
        p25Ppk: null,
        p75Ppk: null,
        sampleSize: 0,
        storeCount: 0,
        weeklyChangePct: null,
      },
    ]);
  });

  it('calcula las ventanas de 4 semanas sobre los precios por comercio y semana', async () => {
    const res = await api().get('/api/v1/index/provinces').query({ weeks: 4 }).expect(200);
    expect(res.body.from).toBe(shiftDate(current, -21));
    expect(res.body.country).toMatchObject({
      published: true,
      medianPpk: 5000,
      sampleSize: 15,
      storeCount: 3,
      weeklyChangePct: null,
    });
  });

  it('valida la ventana', async () => {
    await api().get('/api/v1/index/provinces').query({ weeks: 3 }).expect(400);
  });

  it('devuelve el histórico semanal de una zona', async () => {
    const res = await api()
      .get('/api/v1/index/history')
      .query({ level: 'department', id: '06840', weeks: 3 })
      .expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        weekStart: shiftDate(current, -14),
        published: false,
        medianPpk: null,
      }),
      expect.objectContaining({
        weekStart: shiftDate(current, -7),
        published: true,
        medianPpk: 5000,
        sampleSize: 6,
      }),
      expect.objectContaining({
        weekStart: current,
        published: true,
        medianPpk: 6000,
        sampleSize: 6,
        storeCount: 3,
      }),
    ]);
  });
});
