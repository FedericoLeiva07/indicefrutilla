import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, Matches } from 'class-validator';

export class ResolveQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;
}

export class ProvinceParamsDto {
  @Matches(/^\d{2}$/)
  id: string;
}

export class DepartmentParamsDto {
  @Matches(/^\d{5}$/)
  id: string;
}
