import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { DepartmentDto, LocalityDto, ProvinceDto, ResolvedLocationDto } from '@indice/shared';
import { GeoService } from '../application/geo.service';
import { DepartmentParamsDto, ProvinceParamsDto, ResolveQueryDto } from './geo.dto';

const CACHE_ONE_DAY = 'public, max-age=86400';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('provinces')
  @Header('Cache-Control', CACHE_ONE_DAY)
  provinces(): Promise<ProvinceDto[]> {
    return this.geo.provinces();
  }

  @Get('provinces/:id/departments')
  @Header('Cache-Control', CACHE_ONE_DAY)
  departments(@Param() params: ProvinceParamsDto): Promise<DepartmentDto[]> {
    return this.geo.departments(params.id);
  }

  @Get('departments/:id/localities')
  @Header('Cache-Control', CACHE_ONE_DAY)
  localities(@Param() params: DepartmentParamsDto): Promise<LocalityDto[]> {
    return this.geo.localities(params.id);
  }

  @Get('resolve')
  resolve(@Query() query: ResolveQueryDto): Promise<ResolvedLocationDto> {
    return this.geo.resolve(query.lat, query.lng);
  }
}
