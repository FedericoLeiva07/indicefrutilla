import { Module } from '@nestjs/common';
import { DeviceModule } from '../device/device.module';
import { GeoModule } from '../geo/geo.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { TurnstileModule } from '../turnstile/turnstile.module';
import { StoresController } from './api/stores.controller';
import { StoresService } from './application/stores.service';
import { StoresQueries } from './infra/stores.queries';

@Module({
  imports: [DeviceModule, GeoModule, IdempotencyModule, TurnstileModule],
  controllers: [StoresController],
  providers: [StoresService, StoresQueries],
  exports: [StoresQueries],
})
export class StoresModule {}
