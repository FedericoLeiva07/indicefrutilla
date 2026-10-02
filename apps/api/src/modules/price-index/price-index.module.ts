import { Module } from '@nestjs/common';
import { ReferenceModule } from '../reference/reference.module';
import { PriceIndexController } from './api/price-index.controller';
import { PriceIndexService } from './application/price-index.service';
import { PriceIndexQueries } from './infra/price-index.queries';

@Module({
  imports: [ReferenceModule],
  controllers: [PriceIndexController],
  providers: [PriceIndexQueries, PriceIndexService],
  exports: [PriceIndexQueries, PriceIndexService],
})
export class PriceIndexModule {}
