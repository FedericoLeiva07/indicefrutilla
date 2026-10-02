import { Module } from '@nestjs/common';
import { GeoController } from './api/geo.controller';
import { GeoService } from './application/geo.service';
import { GeoQueries } from './infra/geo.queries';

@Module({
  controllers: [GeoController],
  providers: [GeoService, GeoQueries],
  exports: [GeoService],
})
export class GeoModule {}
