import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createValidationPipe } from './common/validation';
import type { Env } from './config/env';
import { proxyGate } from './modules/edge/api/proxy-gate';

export function setupApp(app: NestExpressApplication, env: Env): void {
  app.disable('x-powered-by');
  if (env.PROXY_SECRET) app.use(proxyGate(env.PROXY_SECRET));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(createValidationPipe());
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.enableCors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()) });

  if (env.NODE_ENV === 'production') return;

  const config = new DocumentBuilder()
    .setTitle('Índice Frutilla API')
    .setVersion('1')
    .addGlobalParameters({ name: 'X-Device-Id', in: 'header', required: false })
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));
}
