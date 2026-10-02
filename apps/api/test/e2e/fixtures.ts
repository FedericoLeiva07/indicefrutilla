import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';

export const TRES_DE_FEBRERO_POLYGON = {
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

export const CASEROS = { lat: -34.6045, lng: -58.5623 };

export async function resetDatabase(db: DataSource): Promise<void> {
  await db.query(
    `TRUNCATE idempotency_keys, reference_prices, price_index_weekly, reports, stores,
              localities, departments, provinces RESTART IDENTITY CASCADE`,
  );
}

export async function seedTresDeFebrero(db: DataSource): Promise<void> {
  await db.query(
    `INSERT INTO provinces (id, name, centroid)
     VALUES ('06', 'Buenos Aires', ST_SetSRID(ST_MakePoint(-60.5, -36.6), 4326)::geography)`,
  );
  await db.query(
    `INSERT INTO departments (id, province_id, name, category, centroid, geom)
     VALUES ('06840', '06', 'Tres de Febrero', 'Partido',
             ST_SetSRID(ST_MakePoint(-58.57, -34.595), 4326)::geography,
             ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326))::geography)`,
    [JSON.stringify(TRES_DE_FEBRERO_POLYGON)],
  );
}

export async function insertStore(
  db: DataSource,
  store: { name: string; lat: number; lng: number; address?: string },
): Promise<number> {
  const normalized = store.name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  const [row]: Array<{ id: number }> = await db.query(
    `INSERT INTO stores (name, name_normalized, address, location, province_id, department_id,
                         created_by_device, created_ip_hash)
     VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, '06', '06840', $6, '\\x00')
     RETURNING id`,
    [store.name, normalized, store.address ?? 'Calle 123', store.lat, store.lng, randomUUID()],
  );
  return row!.id;
}

export const newDevice = () => randomUUID();
