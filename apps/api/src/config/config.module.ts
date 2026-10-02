import { Global, Inject, Module } from '@nestjs/common';
import { type Env, loadEnv } from './env';

export const ENV = Symbol('ENV');
export const InjectEnv = () => Inject(ENV);

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}

export type { Env };
