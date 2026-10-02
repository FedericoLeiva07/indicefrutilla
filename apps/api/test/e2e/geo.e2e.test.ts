import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app';

const TRES_DE_FEBRERO = {
  type: 'Polygon',
  coordinates: [
    [
      [-58.6, -34.62],
      [-58.54, -34.62],
      [-58.54, -34.57],
      [-58.6, -34.57],
      [-58.6, -34.62],
    ],
  ],
};

describe('geo (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
    const db = app.get(DataSource);
    await db.query('TRUNCATE localities, departments, provinces');
    await db.query(
      `INSERT INTO provinces (id, name, centroid)
       VALUES ('06', 'Buenos Aires', ST_SetSRID(ST_MakePoint(-60.5, -36.6), 4326)::geography)`,
    );
    await db.query(
      `INSERT INTO departments (id, province_id, name, category, centroid, geom)
       VALUES ('06840', '06', 'Tres de Febrero', 'Partido',
               ST_SetSRID(ST_MakePoint(-58.57, -34.595), 4326)::geography,
               ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))::geography)`,
      [JSON.stringify(TRES_DE_FEBRERO)],
    );
    await db.query(
      `INSERT INTO localities (id, province_id, department_id, name, centroid)
       VALUES ('06840010', '06', '06840', 'Caseros', ST_SetSRID(ST_MakePoint(-58.5634, -34.6066), 4326)::geography)`,
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  const api = () => request(app.getHttpServer());

  it('lista provincias con su centroide', async () => {
    const res = await api().get('/api/v1/geo/provinces').expect(200);
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
    expect(res.body).toEqual([
      { id: '06', name: 'Buenos Aires', centroid: { lat: -36.6, lng: -60.5 } },
    ]);
  });

  it('lista departamentos y localidades', async () => {
    const deps = await api().get('/api/v1/geo/provinces/06/departments').expect(200);
    expect(deps.body).toMatchObject([{ id: '06840', provinceId: '06', name: 'Tres de Febrero' }]);

    const locs = await api().get('/api/v1/geo/departments/06840/localities').expect(200);
    expect(locs.body).toMatchObject([{ id: '06840010', departmentId: '06840', name: 'Caseros' }]);
  });

  it('ordena los nombres con números de forma natural', async () => {
    const db = app.get(DataSource);
    await db.query(
      `INSERT INTO provinces (id, name, centroid)
       VALUES ('02', 'Ciudad Autónoma de Buenos Aires', ST_SetSRID(ST_MakePoint(-58.44, -34.61), 4326)::geography)`,
    );
    for (const [id, name] of [
      ['02010', 'Comuna 10'],
      ['02002', 'Comuna 2'],
      ['02001', 'Comuna 1'],
    ]) {
      await db.query(
        `INSERT INTO departments (id, province_id, name, category, centroid, geom)
         VALUES ($1, '02', $2, 'Comuna', ST_SetSRID(ST_MakePoint(-58.44, -34.61), 4326)::geography,
                 ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint(-58.44, -34.61), 4326), 0.001))::geography)`,
        [id, name],
      );
    }
    const res = await api().get('/api/v1/geo/provinces/02/departments').expect(200);
    expect(res.body.map((d: { name: string }) => d.name)).toEqual([
      'Comuna 1',
      'Comuna 2',
      'Comuna 10',
    ]);
  });

  it('responde NOT_FOUND para una provincia inexistente', async () => {
    const res = await api().get('/api/v1/geo/provinces/99/departments').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('valida el formato de los ids', async () => {
    const res = await api().get('/api/v1/geo/provinces/abc/departments').expect(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ field: 'id', code: 'matches' }],
    });
  });

  it('resuelve un punto dentro del departamento', async () => {
    const res = await api()
      .get('/api/v1/geo/resolve')
      .query({ lat: -34.6045, lng: -58.5623 })
      .expect(200);
    expect(res.body).toEqual({
      province: { id: '06', name: 'Buenos Aires' },
      department: { id: '06840', name: 'Tres de Febrero' },
    });
  });

  it('tolera un punto a menos de 5 km del límite', async () => {
    const res = await api()
      .get('/api/v1/geo/resolve')
      .query({ lat: -34.6, lng: -58.52 })
      .expect(200);
    expect(res.body.department.id).toBe('06840');
  });

  it('responde OUTSIDE_COVERAGE fuera de Argentina', async () => {
    const res = await api()
      .get('/api/v1/geo/resolve')
      .query({ lat: -34.9, lng: -56.16 })
      .expect(404);
    expect(res.body.error.code).toBe('OUTSIDE_COVERAGE');
  });

  it('valida lat y lng', async () => {
    const res = await api().get('/api/v1/geo/resolve').query({ lat: 120, lng: 'x' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'lat',
      'lng',
    ]);
  });

  it('expone el health check', async () => {
    await api().get('/api/v1/health').expect(200, { status: 'ok' });
  });
});
