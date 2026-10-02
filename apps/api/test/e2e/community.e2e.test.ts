import { randomUUID } from 'node:crypto';
import { argentinaDate, weekStart } from '@indice/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from './app';
import { CASEROS, insertReport, insertStore, resetDatabase, seedTresDeFebrero } from './fixtures';

describe('community (e2e)', () => {
  let app: NestExpressApplication;
  let db: DataSource;
  let reportId: number;
  const today = argentinaDate();

  beforeAll(async () => {
    app = await createTestApp({ TRUST_CLOUDFLARE: 'true' });
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetDatabase(db);
    await seedTresDeFebrero(db);
    const storeId = await insertStore(db, { name: 'Verdulería', ...CASEROS });
    reportId = await insertReport(db, { storeId, pricePerKg: 5000, observedAt: today });
  });

  afterAll(async () => {
    await app?.close();
  });

  const api = () => request(app.getHttpServer());
  const vote = (
    value: number,
    device = randomUUID(),
    ip = `10.0.0.${Math.floor(Math.random() * 250)}`,
  ) =>
    api()
      .post(`/api/v1/reports/${reportId}/votes`)
      .set('X-Device-Id', device)
      .set('CF-Connecting-IP', ip)
      .send({ value });
  const flag = (
    reason = 'precio_falso',
    device = randomUUID(),
    ip = `10.1.0.${Math.floor(Math.random() * 250)}`,
  ) =>
    api()
      .post(`/api/v1/reports/${reportId}/flags`)
      .set('X-Device-Id', device)
      .set('CF-Connecting-IP', ip)
      .send({ reason });

  describe('votos (E7)', () => {
    it('registra el voto y devuelve el contador', async () => {
      const res = await vote(1).expect(201);
      expect(res.body).toEqual({ votes: { up: 1, down: 0 }, myVote: 1, active: true });
    });

    it('responde ALREADY_VOTED con el contador actual al repetir desde el mismo dispositivo', async () => {
      const device = randomUUID();
      await vote(1, device).expect(201);
      const res = await vote(-1, device).expect(409);
      expect(res.body.error).toMatchObject({
        code: 'ALREADY_VOTED',
        details: { votes: { up: 1, down: 0 }, myVote: 1 },
      });
    });

    it('muestra los votos y el voto propio en la lista', async () => {
      const device = randomUUID();
      await vote(1, device).expect(201);
      await vote(-1).expect(201);
      const res = await api()
        .get('/api/v1/reports')
        .query(CASEROS)
        .set('X-Device-Id', device)
        .expect(200);
      expect(res.body.items[0]).toMatchObject({ votes: { up: 1, down: 1 }, myVote: 1 });
      const anon = await api().get('/api/v1/reports').query(CASEROS).expect(200);
      expect(anon.body.items[0].myVote).toBeNull();
    });

    it('con saldo de -3 entre IP distintas la oferta deja de estar vigente (E9)', async () => {
      await vote(-1, randomUUID(), '10.9.0.1').expect(201);
      await vote(-1, randomUUID(), '10.9.0.2').expect(201);
      const third = await vote(-1, randomUUID(), '10.9.0.3').expect(201);
      expect(third.body.active).toBe(false);

      const list = await api().get('/api/v1/reports').query(CASEROS).expect(200);
      expect(list.body.total).toBe(0);
      const detail = await api().get(`/api/v1/reports/${reportId}`).expect(410);
      expect(detail.body.error).toMatchObject({
        code: 'REPORT_UNAVAILABLE',
        details: { reason: 'downvoted' },
      });
      const late = await vote(1).expect(410);
      expect(late.body.error.code).toBe('REPORT_UNAVAILABLE');
    });

    it('los votos de dispositivos distintos con la misma IP cuentan una sola vez', async () => {
      for (let i = 0; i < 4; i++) await vote(-1, randomUUID(), '10.9.9.9').expect(201);
      await api().get(`/api/v1/reports/${reportId}`).expect(200);
    });

    it('valida el valor y exige X-Device-Id', async () => {
      const bad = await vote(2).expect(400);
      expect(bad.body.error.details).toEqual([{ field: 'value', code: 'isIn' }]);
      await api().post(`/api/v1/reports/${reportId}/votes`).send({ value: 1 }).expect(400);
      await api()
        .post('/api/v1/reports/999999/votes')
        .set('X-Device-Id', randomUUID())
        .send({ value: 1 })
        .expect(404);
    });
  });

  describe('denuncias (E8)', () => {
    it('registra la denuncia y rechaza la repetida', async () => {
      const device = randomUUID();
      const res = await flag('spam', device).expect(201);
      expect(res.body).toEqual({ hidden: false });
      const again = await flag('duplicada', device).expect(409);
      expect(again.body.error.code).toBe('ALREADY_FLAGGED');
    });

    it('con 3 denuncias de IP distintas marca la oferta y recalcula su semana', async () => {
      const storeIds = [];
      for (let i = 0; i < 4; i++) {
        storeIds.push(
          await insertStore(db, { name: `Otro ${i}`, lat: -34.6 - i * 0.001, lng: -58.56 }),
        );
      }
      for (const id of storeIds)
        await insertReport(db, { storeId: id, pricePerKg: 6000, observedAt: today });
      await db.query(
        `INSERT INTO price_index_weekly (week_start, level, zone_id, median_ppk, sample_size, store_count, published)
         VALUES ($1, 'country', 'AR', 9999, 99, 99, true)`,
        [weekStart(today)],
      );

      await flag('precio_falso', randomUUID(), '10.2.0.1').expect(201);
      await flag('precio_falso', randomUUID(), '10.2.0.1').expect(201);
      await flag('precio_falso', randomUUID(), '10.2.0.2').expect(201);
      const last = await flag('spam', randomUUID(), '10.2.0.3').expect(201);
      expect(last.body).toEqual({ hidden: true });

      const [report] = await db.query(`SELECT status FROM reports WHERE id = $1`, [reportId]);
      expect(report.status).toBe('flagged');
      const [index] = await db.query(
        `SELECT median_ppk, sample_size FROM price_index_weekly WHERE week_start = $1 AND level = 'country'`,
        [weekStart(today)],
      );
      expect(index).toEqual({ median_ppk: 6000, sample_size: 4 });
      const detail = await api().get(`/api/v1/reports/${reportId}`).expect(410);
      expect(detail.body.error.details.reason).toBe('flagged');
    });

    it('valida el motivo', async () => {
      const res = await flag('foto').expect(400);
      expect(res.body.error.details).toEqual([{ field: 'reason', code: 'isIn' }]);
    });
  });
});
