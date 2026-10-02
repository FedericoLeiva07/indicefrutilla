import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/app.setup';
import { ENV } from '../../src/config/config.module';
import { loadEnv } from '../../src/config/env';
import { TurnstileVerifier } from '../../src/modules/turnstile/turnstile.verifier';
import { testDatabaseUrl } from './test-db';

export const FAILING_TURNSTILE_TOKEN = 'turnstile-fail';

export class FakeTurnstileVerifier extends TurnstileVerifier {
  readonly tokens: string[] = [];

  async verify(token: string): Promise<boolean> {
    this.tokens.push(token);
    return token !== FAILING_TURNSTILE_TOKEN;
  }
}

export async function createTestApp(
  overrides: Record<string, string> = {},
): Promise<NestExpressApplication> {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl(),
    IP_HASH_SECRET: 'test-secret-'.repeat(4),
    TURNSTILE_SECRET_KEY: 'test',
    THROTTLE_ENABLED: 'false',
    PLAUSIBLE_MIN_PPK: '1000',
    PLAUSIBLE_MAX_PPK: '50000',
    ...overrides,
  });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(env)
    .overrideProvider(TurnstileVerifier)
    .useClass(FakeTurnstileVerifier)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  setupApp(app, env);
  await app.init();
  return app;
}
