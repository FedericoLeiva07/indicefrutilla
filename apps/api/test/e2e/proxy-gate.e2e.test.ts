import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app';

const SECRET = 'proxy-secret-'.repeat(4);

describe('proxy de la web (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({ PROXY_SECRET: SECRET, THROTTLE_ENABLED: 'true' });
  });

  afterAll(async () => {
    await app?.close();
  });

  const api = () => request(app.getHttpServer());
  const viaWeb = (path: string, ip: string) =>
    api().get(path).set('X-Proxy-Secret', SECRET).set('X-Client-IP', ip);

  it('rechaza con FORBIDDEN lo que no llega por el proxy, también rutas inexistentes', async () => {
    for (const path of ['/api/v1/geo/provinces', '/api/v1/no-existe', '/docs']) {
      const res = await api().get(path).expect(403);
      expect(res.body).toEqual({
        error: { code: 'FORBIDDEN', message: 'Esta API solo responde a la web de Índice' },
      });
    }
    await api().get('/api/v1/geo/provinces').set('X-Proxy-Secret', 'otro').expect(403);
  });

  it('deja pasar el health check sin secreto', async () => {
    await api().get('/api/v1/health').expect(200);
  });

  it('atiende lo que llega por el proxy y no expone la tecnología', async () => {
    const res = await viaWeb('/api/v1/geo/provinces', '190.0.0.1').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('limita por la IP real que manda el proxy', async () => {
    for (let i = 0; i < 5; i++) await viaWeb('/api/v1/geo/provinces', '190.0.0.2').expect(200);
    await viaWeb('/api/v1/geo/provinces', '190.0.0.2').expect(429);
    await viaWeb('/api/v1/geo/provinces', '190.0.0.3').expect(200);
  });
});
