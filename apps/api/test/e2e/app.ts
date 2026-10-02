import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/app.setup';
import { ENV } from '../../src/config/config.module';
import { loadEnv } from '../../src/config/env';
import { testDatabaseUrl } from './test-db';

export async function createTestApp(): Promise<NestExpressApplication> {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl(),
    IP_HASH_SECRET: 'test-secret-'.repeat(4),
  });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(env)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  setupApp(app, env);
  await app.init();
  return app;
}
