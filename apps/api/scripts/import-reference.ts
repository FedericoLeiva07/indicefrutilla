import '../src/config/load-dotenv';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { MERCADO_CENTRAL_DEFAULT_URL } from '../src/config/env';
import { typeormOptions } from '../src/database/typeorm-options';
import { MercadoCentralClient } from '../src/modules/reference/import/mercado-central.client';
import { ReferenceImportService } from '../src/modules/reference/import/reference-import.service';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const dataSource = await new DataSource(typeormOptions(url)).initialize();
  try {
    const client = new MercadoCentralClient({
      MERCADO_CENTRAL_URL: process.env.MERCADO_CENTRAL_URL ?? MERCADO_CENTRAL_DEFAULT_URL,
    });
    const summary = await new ReferenceImportService(dataSource, client).run(
      process.argv.includes('--all') ? 'all' : 'recent',
    );
    console.log(JSON.stringify(summary, null, 2));
    if (summary.errors.length > 0) process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
