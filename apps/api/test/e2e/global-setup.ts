import { DataSource } from 'typeorm';
import { migrations } from '../../src/database/migrations';
import { testDatabaseUrl } from './test-db';

export default async function setup(): Promise<void> {
  const ds = new DataSource({ type: 'postgres', url: testDatabaseUrl(), migrations });
  await ds.initialize();
  try {
    await ds.query('DROP SCHEMA IF EXISTS public CASCADE');
    await ds.query('CREATE SCHEMA public');
    await ds.runMigrations();
  } finally {
    await ds.destroy();
  }
}
