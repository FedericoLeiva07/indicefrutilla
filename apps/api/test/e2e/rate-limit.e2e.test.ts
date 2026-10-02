import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import Redis from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RedisThrottlerStorage } from '../../src/modules/rate-limit/redis-throttler.storage';
import { createTestApp } from './app';

describe('rate limit (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({ THROTTLE_ENABLED: 'true', TRUST_CLOUDFLARE: 'true' });
  });

  afterAll(async () => {
    await app?.close();
  });

  const api = () => request(app.getHttpServer());
  const randomIp = () => `10.${rand()}.${rand()}.${rand()}`;
  const rand = () => Math.floor(Math.random() * 250);
  const postStore = (ip: string, device: string) =>
    api().post('/api/v1/stores').set('CF-Connecting-IP', ip).set('X-Device-Id', device).send({});

  it('permite 5 requests por segundo por IP en cualquier endpoint (C9)', async () => {
    const ip = randomIp();
    for (let i = 0; i < 5; i++) {
      await api().get('/api/v1/health').set('CF-Connecting-IP', ip).expect(200);
    }
    const res = await api().get('/api/v1/geo/provinces').set('CF-Connecting-IP', ip).expect(429);
    expect(res.body.error).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 1 });
    expect(res.headers['retry-after']).toBe('1');

    await api().get('/api/v1/health').set('CF-Connecting-IP', randomIp()).expect(200);
  });

  it('permite 5 escrituras por minuto por dispositivo', async () => {
    const device = randomUUID();
    for (let i = 0; i < 5; i++) {
      await postStore(randomIp(), device).expect(400);
    }
    const res = await postStore(randomIp(), device).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.retryAfterSeconds).toBeGreaterThan(50);

    await postStore(randomIp(), randomUUID()).expect(400);
  });

  it('permite 10 escrituras por minuto por IP', async () => {
    const ip = randomIp();
    for (let i = 0; i < 10; i++) {
      if (i === 5) await new Promise((r) => setTimeout(r, 1_100));
      await postStore(ip, randomUUID()).expect(400);
    }
    await new Promise((r) => setTimeout(r, 1_100));
    const res = await postStore(ip, randomUUID()).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe.skipIf(!process.env.TEST_REDIS_URL)('RedisThrottlerStorage', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis(process.env.TEST_REDIS_URL!);
  });

  afterAll(async () => {
    await redis?.quit();
  });

  it('cuenta hits por ventana y bloquea al superar el límite', async () => {
    const storage = new RedisThrottlerStorage(redis, `test:${randomUUID()}`);
    const hit = () => storage.increment('k', 1_000, 2, 1_000, 'burst');

    expect(await hit()).toMatchObject({ totalHits: 1, isBlocked: false, timeToExpire: 1 });
    expect(await hit()).toMatchObject({ totalHits: 2, isBlocked: false });
    expect(await hit()).toMatchObject({ totalHits: 3, isBlocked: true, timeToBlockExpire: 1 });

    await new Promise((r) => setTimeout(r, 1_100));
    expect(await hit()).toMatchObject({ totalHits: 1, isBlocked: false });
  });

  it('separa los contadores por throttler', async () => {
    const storage = new RedisThrottlerStorage(redis, `test:${randomUUID()}`);
    await storage.increment('k', 60_000, 5, 0, 'writes-ip');
    expect(await storage.increment('k', 60_000, 5, 0, 'writes-device')).toMatchObject({
      totalHits: 1,
    });
  });
});
