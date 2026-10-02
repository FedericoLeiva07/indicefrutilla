import '../src/config/load-dotenv';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';

const BASE_URL = 'https://infra.datos.gob.ar/georef';
const CACHE_DIR = join(__dirname, '..', 'seed-cache');
const FILES = ['provincias.json', 'departamentos.geojson', 'localidades.json'] as const;

interface Centroid {
  lat: number;
  lon: number;
}

async function fetchFile(name: string, useCache: boolean): Promise<unknown> {
  const path = join(CACHE_DIR, name);
  if (!(useCache && existsSync(path))) {
    const res = await fetch(`${BASE_URL}/${name}`);
    if (!res.ok) throw new Error(`Georef respondió ${res.status} para ${name}`);
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const useCache = process.argv.includes('--cached');

  const [provJson, depJson, locJson] = (await Promise.all(
    FILES.map((f) => fetchFile(f, useCache)),
  )) as [
    { provincias: Array<{ id: string; nombre: string; centroide: Centroid }> },
    {
      features: Array<{
        geometry: unknown;
        properties: {
          id: string;
          nombre: string;
          categoria: string;
          provincia: { id: string };
          centroide: Centroid;
        };
      }>;
    },
    {
      localidades: Array<{
        id: string;
        nombre: string;
        provincia: { id: string };
        departamento: { id: string | null } | null;
        centroide: Centroid;
      }>;
    },
  ];

  const provinces = provJson.provincias.map((p) => ({
    id: p.id,
    name: p.nombre,
    lat: p.centroide.lat,
    lng: p.centroide.lon,
  }));
  const departments = depJson.features.map((f) => ({
    id: f.properties.id,
    province_id: f.properties.provincia.id,
    name: f.properties.nombre,
    category: f.properties.categoria,
    lat: f.properties.centroide.lat,
    lng: f.properties.centroide.lon,
    geom: JSON.stringify(f.geometry),
  }));
  const localities = locJson.localidades.map((l) => ({
    id: l.id,
    province_id: l.provincia.id,
    department_id: l.departamento?.id || null,
    name: l.nombre,
    lat: l.centroide.lat,
    lng: l.centroide.lon,
  }));

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO provinces (id, name, centroid)
       SELECT r.id, r.name, ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography
         FROM jsonb_to_recordset($1::jsonb) AS r(id text, name text, lat float8, lng float8)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, centroid = EXCLUDED.centroid`,
      [JSON.stringify(provinces)],
    );
    await client.query(
      `INSERT INTO departments (id, province_id, name, category, centroid, geom)
       SELECT r.id, r.province_id, r.name, r.category,
              ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography,
              ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(r.geom), 4326))::geography
         FROM jsonb_to_recordset($1::jsonb)
           AS r(id text, province_id text, name text, category text, lat float8, lng float8, geom text)
       ON CONFLICT (id) DO UPDATE SET province_id = EXCLUDED.province_id, name = EXCLUDED.name,
              category = EXCLUDED.category, centroid = EXCLUDED.centroid, geom = EXCLUDED.geom`,
      [JSON.stringify(departments)],
    );
    await client.query(
      `INSERT INTO localities (id, province_id, department_id, name, centroid)
       SELECT r.id, r.province_id, d.id, r.name, ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326)::geography
         FROM jsonb_to_recordset($1::jsonb)
           AS r(id text, province_id text, department_id text, name text, lat float8, lng float8)
         LEFT JOIN departments d ON d.id = r.department_id
       ON CONFLICT (id) DO UPDATE SET province_id = EXCLUDED.province_id,
              department_id = EXCLUDED.department_id, name = EXCLUDED.name, centroid = EXCLUDED.centroid`,
      [JSON.stringify(localities)],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }

  console.log(
    `Georef cargado: ${provinces.length} provincias, ${departments.length} departamentos, ${localities.length} localidades`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
