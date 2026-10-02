import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { argentinaDate, shiftDate } from '@indice/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { zipSync } from 'fflate';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MercadoCentralClient } from '../../src/modules/reference/import/mercado-central.client';
import { ReferenceImportService } from '../../src/modules/reference/import/reference-import.service';
import { createTestApp } from './app';
import { resetDatabase } from './fixtures';

const FIXTURES = join(__dirname, '..', 'fixtures', 'mercado-central');
const fixture = (name: string) => new Uint8Array(readFileSync(join(FIXTURES, name)));

class FakeMercadoCentral extends MercadoCentralClient {
  readonly requested: string[] = [];

  constructor(
    private readonly html: string,
    private readonly zips: Record<string, Uint8Array>,
  ) {
    super({ MERCADO_CENTRAL_URL: 'https://mercadocentral.gob.ar/información/precios-mayoristas' });
  }

  override async fetchPage(): Promise<string> {
    return this.html;
  }

  override async fetchZip(url: string): Promise<Uint8Array> {
    this.requested.push(url);
    const zip = this.zips[url];
    if (!zip) throw new Error(`404 ${url}`);
    return zip;
  }
}

describe('reference (e2e)', () => {
  let app: NestExpressApplication;
  let db: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetDatabase(db);
  });

  afterAll(async () => {
    await app?.close();
  });

  const api = () => request(app.getHttpServer());

  describe('GET /reference/latest', () => {
    it('usa el rango del entorno sin datos', async () => {
      const res = await api().get('/api/v1/reference/latest').expect(200);
      expect(res.body).toEqual({
        date: null,
        modalPpk: null,
        plausibleMin: 1000,
        plausibleMax: 50000,
        source: null,
      });
    });

    it('toma la mediana de las referencias diarias de los últimos 7 días con datos', async () => {
      const today = argentinaDate();
      const daily = [9000, 3000, 4000, 5000, 6000, 7000, 8000, 4500];
      for (const [i, modal] of daily.entries()) {
        for (const [origin, factor] of [
          ['TUCUMAN', 1],
          ['SANTA FE', 1.2],
          ['CTES.', 0.8],
        ] as const) {
          await db.query(
            `INSERT INTO reference_prices (date, origin, package, kg, quality, size, min_ppk, modal_ppk, max_ppk, source_file)
             VALUES ($1, $2, 'CA', 2, 'EL', 'GRANEL', 0, $3, 99999, 'RF.XLS')`,
            [shiftDate(today, -(i + 1)), origin, modal * factor],
          );
        }
      }
      const res = await api().get('/api/v1/reference/latest').expect(200);
      expect(res.body).toEqual({
        date: shiftDate(today, -1),
        modalPpk: 6000,
        plausibleMin: 4200,
        plausibleMax: 24000,
        source: 'Mercado Central de Buenos Aires',
      });
    });
  });

  describe('importador', () => {
    const base = 'https://mercadocentral.gob.ar/sites/default/files/precios_mayoristas';
    const html = `
      <a href="${base}/FRUTAS_SEPTIEMBRE_26_0.zip">Frutas septiembre</a>
      <a href="/sites/default/files/precios_mayoristas/FRUTRAS_AGOSTO-26_0.zip">Frutas agosto</a>
      <a href="${base}/FRUTAS%20%20ENERO-26_0.zip">Frutas enero</a>
      <a href="${base}/HORTALIZA_SEPTIENBRE_26_0.zip">Hortalizas</a>`;

    function importer(zips: Record<string, Uint8Array>) {
      const client = new FakeMercadoCentral(html, zips);
      return { client, service: new ReferenceImportService(db, client) };
    }

    const septiembre = zipSync({
      'RF040926.XLS': fixture('RF040926.XLS'),
      'sub/RF300926.XLS': fixture('RF300926.XLS'),
      'FRUTAS_SEPTIEMBRE_26.rar': new Uint8Array([1, 2, 3]),
      'anidado.zip': zipSync({ 'RF010926.XLS': fixture('RF040926.XLS') }),
    });

    it('baja solo los ZIP de frutas del mes actual y el anterior', async () => {
      const { client, service } = importer({ [`${base}/FRUTAS_SEPTIEMBRE_26_0.zip`]: septiembre });
      const summary = await service.run('recent', new Date('2026-10-01T15:00:00Z'));
      expect(client.requested).toEqual([`${base}/FRUTAS_SEPTIEMBRE_26_0.zip`]);
      expect(summary).toEqual({
        zips: ['FRUTAS_SEPTIEMBRE_26_0.zip'],
        files: 2,
        rows: 12,
        errors: [],
      });
    });

    it('guarda las filas de frutilla y es idempotente', async () => {
      const { service } = importer({ [`${base}/FRUTAS_SEPTIEMBRE_26_0.zip`]: septiembre });
      await service.run('recent', new Date('2026-10-01T15:00:00Z'));
      await service.run('recent', new Date('2026-10-01T15:00:00Z'));

      const rows = await db.query(
        `SELECT to_char(date, 'YYYY-MM-DD') AS date, origin, package, kg, quality, size,
                min_ppk, modal_ppk, max_ppk, source_file
           FROM reference_prices
          WHERE date = '2026-09-04'
          ORDER BY origin, kg`,
      );
      expect(rows).toHaveLength(6);
      expect(rows[0]).toEqual({
        date: '2026-09-04',
        origin: 'BS. AS.',
        package: 'BA',
        kg: 5,
        quality: 'EL',
        size: 'MEDIANO',
        min_ppk: 3200,
        modal_ppk: 3600,
        max_ppk: 4000,
        source_file: 'RF040926.XLS',
      });
      const [{ count }] = await db.query(`SELECT count(*)::int AS count FROM reference_prices`);
      expect(count).toBe(12);
    });

    it('sigue con los demás ZIP si uno falla', async () => {
      const { service } = importer({ [`${base}/FRUTAS_SEPTIEMBRE_26_0.zip`]: septiembre });
      const summary = await service.run('all');
      expect(summary.zips).toEqual(['FRUTAS_SEPTIEMBRE_26_0.zip']);
      expect(summary.errors).toEqual([
        `FRUTRAS_AGOSTO-26_0.zip: 404 ${base}/FRUTRAS_AGOSTO-26_0.zip`,
        `FRUTAS  ENERO-26_0.zip: 404 ${base}/FRUTAS%20%20ENERO-26_0.zip`,
      ]);
      expect(summary.rows).toBe(12);
    });
  });
});
