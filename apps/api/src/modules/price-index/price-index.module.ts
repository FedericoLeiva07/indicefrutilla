import { Module } from '@nestjs/common';
import { PriceIndexQueries } from './infra/price-index.queries';

@Module({
  providers: [PriceIndexQueries],
  exports: [PriceIndexQueries],
})
export class PriceIndexModule {}
