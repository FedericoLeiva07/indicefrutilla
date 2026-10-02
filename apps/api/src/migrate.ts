import './config/load-dotenv';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadEnv } from './config/env';
import { typeormOptions } from './database/typeorm-options';

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
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
