import { type ExecutionContext, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { type ThrottlerModuleOptions, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { type Env, ENV } from '../../config/config.module';
import { DeviceModule } from '../device/device.module';
import { IpHasher } from '../device/ip-hasher.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { RedisConnection } from './redis.provider';
import { AppThrottlerGuard } from './throttle.guard';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

export const THROTTLE_LIMITS = {
  burstPerIp: 5,
  writesPerIp: 10,
  writesPerDevice: 5,
} as const;

function throttlerOptions(
  env: Env,
  ipHasher: IpHasher,
  redis: RedisConnection,
): ThrottlerModuleOptions {
  const ipTracker = (req: Record<string, unknown>) =>
    ipHasher.hashRequest(req as unknown as Request).toString('hex');
  const disabled = () => !env.THROTTLE_ENABLED;
  const isRead = (ctx: ExecutionContext) =>
    disabled() || ctx.switchToHttp().getRequest<Request>().method !== 'POST';

  return {
    skipIf: disabled,
    generateKey: (_ctx, tracker, name) => `${name}:${tracker}`,
    storage: redis.client ? new RedisThrottlerStorage(redis.client) : undefined,
    throttlers: [
      { name: 'burst', ttl: SECOND, limit: THROTTLE_LIMITS.burstPerIp, getTracker: ipTracker },
      {
        name: 'writes-ip',
        ttl: MINUTE,
        limit: THROTTLE_LIMITS.writesPerIp,
        getTracker: ipTracker,
        skipIf: isRead,
      },
      {
        name: 'writes-device',
        ttl: MINUTE,
        limit: THROTTLE_LIMITS.writesPerDevice,
        getTracker: (req) =>
          String((req as unknown as Request).header('x-device-id')).toLowerCase(),
        skipIf: (ctx) =>
          isRead(ctx) || !ctx.switchToHttp().getRequest<Request>().header('x-device-id'),
      },
    ],
  };
}

@Module({
  imports: [DeviceModule],
  providers: [RedisConnection],
  exports: [DeviceModule, RedisConnection],
})
export class RateLimitInfraModule {}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [RateLimitInfraModule],
      inject: [ENV, IpHasher, RedisConnection],
      useFactory: throttlerOptions,
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class RateLimitModule {}
