import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, FAILING_TURNSTILE_TOKEN } from './app';
import { CASEROS, insertStore, newDevice, resetDatabase, seedTresDeFebrero } from './fixtures';

describe('stores (e2e)', () => {
  let app: NestExpressApplication;
  let db: DataSource;

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

  const createStore = (body: Record<string, unknown>, device = newDevice(), key?: string) => {
    const req = api()
      .post('/api/v1/stores')
      .set('X-Device-Id', device)
      .send({
        name: 'Verdulería Don Pepe',
        address: 'Av. San Martín 2500',
        ...CASEROS,
        turnstileToken: 'ok',
        ...body,
      });
    return key ? req.set('Idempotency-Key', key) : req;
  };

  describe('GET /stores/nearby', () => {
    it('ordena por distancia y respeta el radio', async () => {
      const near = await insertStore(db, { name: 'Cerca', lat: -34.6046, lng: -58.5624 });
      const far = await insertStore(db, { name: 'Lejos', lat: -34.62, lng: -58.58 });
      await insertStore(db, { name: 'Afuera', lat: -34.7, lng: -58.7 });

      const res = await api()
        .get('/api/v1/stores/nearby')
        .query({ ...CASEROS, radius: 5000 })
        .expect(200);
      expect(res.body.map((s: { id: number }) => s.id)).toEqual([near, far]);
      expect(res.body[0]).toMatchObject({
        name: 'Cerca',
        provinceId: '06',
        departmentId: '06840',
        reportCount: 0,
        location: { lat: -34.6046, lng: -58.5624 },
      });
      expect(res.body[0].distanceM).toBeLessThan(20);
    });

    it('usa 3 km por defecto y valida el radio', async () => {
      await insertStore(db, { name: 'A 4 km', lat: -34.6405, lng: -58.5623 });
      const res = await api().get('/api/v1/stores/nearby').query(CASEROS).expect(200);
      expect(res.body).toEqual([]);

      const bad = await api()
        .get('/api/v1/stores/nearby')
        .query({ ...CASEROS, radius: 50 })
        .expect(400);
      expect(bad.body.error.details).toEqual([{ field: 'radius', code: 'min' }]);
    });
  });

  describe('GET /stores/search', () => {
    it('encuentra sin importar tildes ni mayúsculas', async () => {
      const id = await insertStore(db, { name: 'Frutería Ñandú', lat: -34.605, lng: -58.563 });
      await insertStore(db, { name: 'Almacén Rosa', lat: -34.605, lng: -58.563 });

      const res = await api()
        .get('/api/v1/stores/search')
        .query({ ...CASEROS, q: 'FRUTERIA nandu' })
        .expect(200);
      expect(res.body.map((s: { id: number }) => s.id)).toEqual([id]);
    });

    it('encuentra por parte del nombre', async () => {
      const id = await insertStore(db, {
        name: 'Verdulería Los Hermanos',
        lat: -34.605,
        lng: -58.563,
      });
      const res = await api()
        .get('/api/v1/stores/search')
        .query({ ...CASEROS, q: 'herma' })
        .expect(200);
      expect(res.body.map((s: { id: number }) => s.id)).toEqual([id]);
    });

    it('devuelve una lista vacía sin resultados (C1)', async () => {
      const res = await api()
        .get('/api/v1/stores/search')
        .query({ ...CASEROS, q: 'inexistente' })
        .expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /stores', () => {
    it('crea el comercio con su provincia y departamento', async () => {
      const device = newDevice();
      const res = await createStore({ name: '  Verdulería Don Pepe  ' }, device).expect(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        name: 'Verdulería Don Pepe',
        address: 'Av. San Martín 2500',
        location: CASEROS,
        provinceId: '06',
        departmentId: '06840',
      });
      const [row] = await db.query(
        `SELECT name_normalized, created_by_device, octet_length(created_ip_hash) AS len FROM stores`,
      );
      expect(row).toEqual({
        name_normalized: 'verduleria don pepe',
        created_by_device: device,
        len: 32,
      });
    });

    it('exige X-Device-Id', async () => {
      const res = await api()
        .post('/api/v1/stores')
        .send({ name: 'X', address: 'Y', ...CASEROS, turnstileToken: 'ok' })
        .expect(400);
      expect(res.body.error.details).toEqual([{ field: 'X-Device-Id', code: 'isUuid' }]);
    });

    it('valida los campos', async () => {
      const res = await createStore({ name: 'X', lat: 200 }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
        'lat',
        'name',
      ]);
    });

    it('responde TURNSTILE_FAILED con un token inválido', async () => {
      const res = await createStore({ turnstileToken: FAILING_TURNSTILE_TOKEN }).expect(403);
      expect(res.body.error.code).toBe('TURNSTILE_FAILED');
    });

    it('responde OUTSIDE_COVERAGE fuera de Argentina', async () => {
      const res = await createStore({ lat: -34.9, lng: -56.16 }).expect(404);
      expect(res.body.error.code).toBe('OUTSIDE_COVERAGE');
    });

    it('detecta un posible duplicado cerca (C2) y acepta confirmedDistinct', async () => {
      const existing = await insertStore(db, {
        name: 'Verduleria Don Pepe',
        lat: -34.6047,
        lng: -58.5624,
      });
      await insertStore(db, { name: 'Kiosco Pepe', lat: -34.6045, lng: -58.5623 });

      const dup = await createStore({ name: 'Verdulería Don Pepe 2' }).expect(409);
      expect(dup.body.error).toMatchObject({
        code: 'STORE_POSSIBLE_DUPLICATE',
        details: {
          candidates: [
            {
              id: existing,
              name: 'Verduleria Don Pepe',
              address: 'Calle 123',
              location: { lat: -34.6047, lng: -58.5624 },
              distanceM: expect.any(Number),
              reportCount: 0,
            },
          ],
        },
      });

      await createStore({ name: 'Verdulería Don Pepe 2', confirmedDistinct: true }).expect(201);
    });

    it('no marca duplicado a más de 50 m', async () => {
      await insertStore(db, { name: 'Verdulería Don Pepe', lat: -34.6055, lng: -58.5623 });
      await createStore({}).expect(201);
    });

    it('repite la respuesta con la misma Idempotency-Key aunque cambie el token', async () => {
      const device = newDevice();
      const key = randomUUID();
      const first = await createStore({}, device, key).expect(201);
      const second = await createStore({ turnstileToken: 'otro' }, device, key).expect(201);
      expect(second.headers['idempotent-replayed']).toBe('true');
      expect(second.body).toEqual(first.body);
      const [{ count }] = await db.query(`SELECT count(*)::int AS count FROM stores`);
      expect(count).toBe(1);
    });

    it('responde IDEMPOTENCY_CONFLICT si la clave llega con otro cuerpo', async () => {
      const device = newDevice();
      const key = randomUUID();
      await createStore({}, device, key).expect(201);
      const res = await createStore({ name: 'Otro nombre' }, device, key).expect(409);
      expect(res.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('limita a 5 comercios por dispositivo por día (C10)', async () => {
      const device = newDevice();
      for (let i = 0; i < 5; i++) {
        await createStore({ name: `Comercio ${i}`, lat: CASEROS.lat + i * 0.001 }, device).expect(
          201,
        );
      }
      const res = await createStore({ name: 'Comercio 6' }, device).expect(429);
      expect(res.body.error.code).toBe('DAILY_LIMIT_REACHED');
      expect(res.body.error.retryAfterSeconds).toBeGreaterThan(0);
      expect(res.body.error.retryAfterSeconds).toBeLessThanOrEqual(86_400);
      expect(res.headers['retry-after']).toBe(String(res.body.error.retryAfterSeconds));
    });
  });
});
