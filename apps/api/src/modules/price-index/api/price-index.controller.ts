import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { IndexHistoryRowDto, IndexSummaryDto, ProvinceIndexDto } from '@indice/shared';
import { PriceIndexService } from '../application/price-index.service';
import {
  IndexHistoryQueryDto,
  IndexSummaryQueryDto,
  ProvinceIndexQueryDto,
} from './price-index.dto';

@ApiTags('index')
@Controller('index')
export class PriceIndexController {
  constructor(private readonly index: PriceIndexService) {}

  @Get('summary')
  @Header('Cache-Control', 'public, max-age=300')
  summary(@Query() query: IndexSummaryQueryDto): Promise<IndexSummaryDto> {
    return this.index.summary(query);
  }

  @Get('provinces')
  @Header('Cache-Control', 'public, max-age=300')
  provinces(@Query() query: ProvinceIndexQueryDto): Promise<ProvinceIndexDto> {
    return this.index.provinces(query.weeks);
  }

  @Get('history')
  @Header('Cache-Control', 'public, max-age=300')
  history(@Query() query: IndexHistoryQueryDto): Promise<IndexHistoryRowDto[]> {
    return this.index.history(query.level, query.id, query.weeks);
  }
}
