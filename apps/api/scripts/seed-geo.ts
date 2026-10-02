import '../src/config/load-dotenv';
import 'reflect-metadata';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { seedGeoref } from '../src/database/georef-seed';
import { typeormOptions } from '../src/database/typeorm-options';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const cacheDir = join(__dirname, '..', 'seed-cache');
  if (!process.argv.includes('--cached')) await rm(cacheDir, { recursive: true, force: true });
  const dataSource = await new DataSource(typeormOptions(url, 1)).initialize();
  try {
    const s = await seedGeoref(dataSource, cacheDir);
    console.log(
      `Georef cargado: ${s.provinces} provincias, ${s.departments} departamentos, ${s.localities} localidades`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
