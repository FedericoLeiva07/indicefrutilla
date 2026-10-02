import '../src/config/load-dotenv';
import 'reflect-metadata';
import { argentinaDate, shiftDate, weekStart } from '@indice/shared';
import { DataSource } from 'typeorm';
import { typeormOptions } from '../src/database/typeorm-options';
import { PriceIndexQueries } from '../src/modules/price-index/infra/price-index.queries';
import { normalizeStoreName } from '../src/modules/stores/domain/normalize-name';

const DEMO_DEVICE = '00000000-0000-4000-8000-00000000de30';

const STORES = [
  {
    name: 'Frutería La Esquina',
    address: 'Av. San Martín 2850',
    lat: -34.6021,
    lng: -58.5611,
    prices: [4400, 4500],
  },
  {
    name: 'Verdulería Don Tito',
    address: 'Valentín Gómez 4720',
    lat: -34.6071,
    lng: -58.5648,
    prices: [4600],
  },
  {
    name: 'Mercado Caseros',
    address: 'Av. Urquiza 4500',
    lat: -34.6098,
    lng: -58.5562,
    prices: [5200, 5000],
  },
  {
    name: 'Verdulería Los Hermanos',
    address: 'Bonifacini 2400',
    lat: -34.5952,
    lng: -58.5689,
    prices: [5600],
  },
  {
    name: 'Frutas del Oeste',
    address: 'Av. Perón 3200',
    lat: -34.6181,
    lng: -58.5701,
    prices: [6000],
  },
  {
    name: 'Verdulería Rosa',
    address: 'Lisandro Medina 1900',
    lat: -34.5891,
    lng: -58.5498,
    prices: [6400],
  },
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const db = await new DataSource(typeormOptions(url)).initialize();
  try {
    const demoReports = `SELECT id FROM reports
                          WHERE device_id = $1 OR store_id IN (SELECT id FROM stores WHERE created_by_device = $1)`;
    await db.query(`DELETE FROM report_votes WHERE report_id IN (${demoReports})`, [DEMO_DEVICE]);
    await db.query(`DELETE FROM report_flags WHERE report_id IN (${demoReports})`, [DEMO_DEVICE]);
    await db.query(`DELETE FROM reports WHERE id IN (${demoReports})`, [DEMO_DEVICE]);
    await db.query(`DELETE FROM stores WHERE created_by_device = $1`, [DEMO_DEVICE]);
    if (process.argv.includes('--reset')) {
      console.log('Datos de demo borrados');
    } else {
      const today = argentinaDate();
      let reports = 0;
      for (const [i, store] of STORES.entries()) {
        const [created]: Array<{ id: number }> = await db.query(
          `WITH pt AS (SELECT ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography AS g),
                dep AS (SELECT d.id, d.province_id FROM departments d, pt ORDER BY ST_Distance(d.geom, pt.g) LIMIT 1)
           INSERT INTO stores (name, name_normalized, address, location, province_id, department_id,
                               created_by_device, created_ip_hash)
           SELECT $1, $2, $5, pt.g, dep.province_id, dep.id, $6, '\\x00' FROM pt, dep
           RETURNING id`,
          [
            store.name,
            normalizeStoreName(store.name),
            store.lat,
            store.lng,
            store.address,
            DEMO_DEVICE,
          ],
        );
        const id = created!.id;
        for (const [j, ppk] of store.prices.entries()) {
          const observedAt = shiftDate(today, -((i + j) % 4));
          const quality = i === 2 && j === 0 ? 'segunda' : 'primera';
          await db.query(
            `INSERT INTO reports (store_id, price_ars, presentation, quantity_g, price_per_kg, quality,
                                  observed_at, device_id, ip_hash, created_at)
             VALUES ($1, $2, 'g500', 500, $3, $4, $5, $6, '\\x00', now() - ($7 || ' minutes')::interval)`,
            [id, ppk / 2, ppk, quality, observedAt, DEMO_DEVICE, String(40 + i * 70)],
          );
          reports += 1;
        }
        for (let week = 1; week < 8; week++) {
          const ppk = store.prices[0]! + week * 250 - (i % 3) * 150;
          await db.query(
            `INSERT INTO reports (store_id, price_ars, presentation, quantity_g, price_per_kg, quality,
                                  observed_at, device_id, ip_hash)
             VALUES ($1, $2, 'kg1', 1000, $2, 'primera', $3, $4, '\\x00')`,
            [id, ppk, shiftDate(today, -7 * week), DEMO_DEVICE],
          );
          reports += 1;
        }
      }
      console.log(`Demo: ${STORES.length} comercios y ${reports} ofertas cerca de Caseros`);
    }
    const index = new PriceIndexQueries(db);
    const monday = weekStart(argentinaDate());
    for (let week = 0; week < 8; week++) await index.recompute(shiftDate(monday, -7 * week));
    console.log('Índice recalculado para las últimas 8 semanas');
  } finally {
    await db.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
