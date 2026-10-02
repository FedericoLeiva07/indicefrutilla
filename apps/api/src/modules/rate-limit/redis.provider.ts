import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { type Env, InjectEnv } from '../../config/config.module';

@Injectable()
export class RedisConnection implements OnApplicationShutdown {
  readonly client: Redis | null;

  constructor(@InjectEnv() env: Env) {
    this.client = env.REDIS_URL
      ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, family: 0 })
      : null;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client?.quit();
  }
}

export const InjectRedis = () => Inject(RedisConnection);
