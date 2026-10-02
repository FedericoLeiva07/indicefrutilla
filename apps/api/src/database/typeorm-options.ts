import { types } from 'pg';
import type { DataSourceOptions } from 'typeorm';
import { entities } from './entities';
import { migrations } from './migrations';

types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => Number(v));

export function typeormOptions(databaseUrl: string, poolSize = 20): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    extra: { max: poolSize },
    entities,
    migrations,
    synchronize: false,
  };
}
