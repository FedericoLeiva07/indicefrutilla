import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { IndexSummaryDto } from '@indice/shared';
import { PriceIndexService } from '../application/price-index.service';
import { IndexSummaryQueryDto } from './price-index.dto';

@ApiTags('index')
@Controller('index')
export class PriceIndexController {
  constructor(private readonly index: PriceIndexService) {}

  @Get('summary')
  @Header('Cache-Control', 'public, max-age=300')
  summary(@Query() query: IndexSummaryQueryDto): Promise<IndexSummaryDto> {
    return this.index.summary(query);
  }
}
