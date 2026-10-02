import './config/load-dotenv';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnv } from './config/env';
import { seedGeoref } from './database/georef-seed';
import { typeormOptions } from './database/typeorm-options';
import { MercadoCentralClient } from './modules/reference/import/mercado-central.client';
import { ReferenceImportService } from './modules/reference/import/reference-import.service';

async function isEmpty(dataSource: DataSource, table: string): Promise<boolean> {
  const rows: unknown[] = await dataSource.query(`SELECT 1 FROM ${table} LIMIT 1`);
  return rows.length === 0;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const dataSource = await new DataSource(typeormOptions(env.DATABASE_URL, 1)).initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      applied.length === 0
        ? 'La base ya está al día'
        : `Migraciones aplicadas: ${applied.map((m) => m.name).join(', ')}`,
    );

    if (await isEmpty(dataSource, 'provinces')) {
      const s = await seedGeoref(dataSource);
      console.log(
        `Georef cargado: ${s.provinces} provincias, ${s.departments} departamentos, ${s.localities} localidades`,
      );
    }

    if (await isEmpty(dataSource, 'reference_prices')) {
      try {
        const summary = await new ReferenceImportService(
          dataSource,
          new MercadoCentralClient(env),
        ).run('all');
        console.log(`Mercado Central: ${summary.rows} precios de ${summary.files} días`);
        for (const error of summary.errors) console.warn(error);
      } catch (err) {
        console.warn(
          'No se pudo importar el histórico del Mercado Central; lo reintenta el worker',
          err,
        );
      }
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
