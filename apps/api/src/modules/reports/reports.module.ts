import { Module } from '@nestjs/common';
import { DeviceModule } from '../device/device.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { PriceIndexModule } from '../price-index/price-index.module';
import { ReferenceModule } from '../reference/reference.module';
import { TurnstileModule } from '../turnstile/turnstile.module';
import { ReportsController } from './api/reports.controller';
import { ReportsReadService } from './application/reports-read.service';
import { ReportsService } from './application/reports.service';
import { ReportsQueries } from './infra/reports.queries';

@Module({
  imports: [DeviceModule, IdempotencyModule, PriceIndexModule, ReferenceModule, TurnstileModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsReadService, ReportsQueries],
})
export class ReportsModule {}
