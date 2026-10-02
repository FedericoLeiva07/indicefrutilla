import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { DatabaseModule } from './database/database.module';
import { CommunityModule } from './modules/community/community.module';
import { DeviceModule } from './modules/device/device.module';
import { GeoModule } from './modules/geo/geo.module';
import { HealthController } from './modules/health/health.controller';
import { PriceIndexModule } from './modules/price-index/price-index.module';
import { RateLimitModule } from './modules/rate-limit/rate-limit.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StoresModule } from './modules/stores/stores.module';

@Module({
  imports: [
    DatabaseModule,
    RateLimitModule,
    DeviceModule,
    GeoModule,
    StoresModule,
    ReportsModule,
    ReferenceModule,
    PriceIndexModule,
    CommunityModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
