import { Injectable } from '@nestjs/common';
import {
  type DepartmentDto,
  ErrorCode,
  type LocalityDto,
  type ProvinceDto,
  type ResolvedLocationDto,
} from '@indice/shared';
import { AppException } from '../../../common/app-exception';
import { GeoQueries } from '../infra/geo.queries';

@Injectable()
export class GeoService {
  constructor(private readonly queries: GeoQueries) {}

  provinces(): Promise<ProvinceDto[]> {
    return this.queries.provinces();
  }

  async departments(provinceId: string): Promise<DepartmentDto[]> {
    if (!(await this.queries.provinceExists(provinceId))) throw notFound('provincia');
    return this.queries.departments(provinceId);
  }

  async localities(departmentId: string): Promise<LocalityDto[]> {
    if (!(await this.queries.departmentExists(departmentId))) throw notFound('departamento');
    return this.queries.localities(departmentId);
  }

  async resolve(lat: number, lng: number): Promise<ResolvedLocationDto> {
    const location = await this.queries.resolve(lat, lng);
    if (!location) {
      throw new AppException(ErrorCode.OutsideCoverage, 404, 'Por ahora solo cubrimos Argentina');
    }
    return location;
  }
}

function notFound(what: string): AppException {
  return new AppException(ErrorCode.NotFound, 404, `No existe esa ${what}`);
}
