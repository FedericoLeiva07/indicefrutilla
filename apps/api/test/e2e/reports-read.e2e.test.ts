import { argentinaDate, shiftDate } from '@indice/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from './app';
import { CASEROS, insertReport, insertStore, resetDatabase, seedTresDeFebrero } from './fixtures';

describe('reports read (e2e)', () => {
  let app: NestExpressApplication;
  let db: DataSource;
  const today = argentinaDate();
  let near: number;
  let far: number;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedTresDeFebrero(db);
    near = await insertStore(db, { name: 'Cerca', lat: -34.6046, lng: -58.5624 });
    far = await insertStore(db, { name: 'Lejos', lat: -34.615, lng: -58.575 });
  });

  afterAll(async () => {
    await app?.close();
  });

  const api = () => request(app.getHttpServer());
  const list = (query: Record<string, unknown> = {}) =>
    api()
      .get('/api/v1/reports')
      .query({ ...CASEROS, ...query });

  it('lista solo ofertas vigentes de los últimos 7 días dentro del radio', async () => {
    const cheap = await insertReport(db, {
      storeId: far,
      pricePerKg: 4400,
      observedAt: shiftDate(today, -6),
    });
    const mid = await insertReport(db, {
      storeId: near,
      pricePerKg: 5200,
      observedAt: today,
      quality: 'segunda',
    });
    await insertReport(db, { storeId: near, pricePerKg: 3000, observedAt: shiftDate(today, -7) });
    await insertReport(db, {
      storeId: near,
      pricePerKg: 3000,
      observedAt: today,
      status: 'flagged',
    });
    const outside = await insertStore(db, { name: 'Afuera', lat: -34.7, lng: -58.7 });
    await insertReport(db, { storeId: outside, pricePerKg: 3000, observedAt: today });

    const res = await list().expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.items.map((r: { id: number }) => r.id)).toEqual([cheap, mid]);
    expect(res.body.items[1]).toMatchObject({
      id: mid,
      priceArs: 5200,
      presentation: 'kg1',
      quantityG: 1000,
      pricePerKg: 5200,
      quality: 'segunda',
      observedAt: today,
      reporterName: null,
      store: {
        id: near,
        name: 'Cerca',
        address: 'Calle 123',
        location: { lat: -34.6046, lng: -58.5624 },
      },
    });
    expect(res.body.items[1].distanceM).toBeLessThan(20);
    expect(new Date(res.body.items[1].createdAt).getTime()).not.toBeNaN();
  });

  it('ordena por distancia y por fecha', async () => {
    const a = await insertReport(db, { storeId: far, pricePerKg: 4000, observedAt: today });
    const b = await insertReport(db, {
      storeId: near,
      pricePerKg: 6000,
      observedAt: shiftDate(today, -1),
    });
    const c = await insertReport(db, {
      storeId: near,
      pricePerKg: 5000,
      observedAt: today,
      createdAt: '2020-01-01T00:00:00Z',
    });

    const byDistance = await list({ sort: 'distance' }).expect(200);
    expect(byDistance.body.items.map((r: { id: number }) => r.id)).toEqual([c, b, a]);
    const byRecent = await list({ sort: 'recent' }).expect(200);
    expect(byRecent.body.items.map((r: { id: number }) => r.id)).toEqual([a, c, b]);
  });

  it('pagina con cursor', async () => {
    for (let i = 0; i < 25; i++) {
      await insertReport(db, { storeId: near, pricePerKg: 4000 + i, observedAt: today });
    }
    const first = await list().expect(200);
    expect(first.body.items).toHaveLength(20);
    expect(first.body.nextCursor).toBe('20');
    const second = await list({ cursor: first.body.nextCursor }).expect(200);
    expect(second.body.items.map((r: { pricePerKg: number }) => r.pricePerKg)).toEqual([
      4020, 4021, 4022, 4023, 4024,
    ]);
    expect(second.body.nextCursor).toBeNull();
  });

  it('valida el orden y el cursor', async () => {
    const res = await list({ sort: 'rating', cursor: 'abc' }).expect(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'cursor',
      'sort',
    ]);
  });

  describe('GET /reports/:id', () => {
    it('devuelve el detalle de una oferta vigente', async () => {
      const id = await insertReport(db, { storeId: near, pricePerKg: 5000, observedAt: today });
      const res = await api().get(`/api/v1/reports/${id}`).expect(200);
      expect(res.body).toMatchObject({
        id,
        pricePerKg: 5000,
        distanceM: null,
        store: { id: near },
      });
    });

    it('responde REPORT_UNAVAILABLE para una oferta vencida o denunciada (E9)', async () => {
      const old = await insertReport(db, {
        storeId: near,
        pricePerKg: 5000,
        observedAt: shiftDate(today, -7),
      });
      const flagged = await insertReport(db, {
        storeId: near,
        pricePerKg: 5000,
        observedAt: today,
        status: 'flagged',
      });
      const expired = await api().get(`/api/v1/reports/${old}`).expect(410);
      expect(expired.body.error).toMatchObject({
        code: 'REPORT_UNAVAILABLE',
        details: { reason: 'expired' },
      });
      const removed = await api().get(`/api/v1/reports/${flagged}`).expect(410);
      expect(removed.body.error.details.reason).toBe('flagged');
    });

    it('responde NOT_FOUND para una oferta inexistente', async () => {
      await api().get('/api/v1/reports/999999').expect(404);
    });
  });
});
