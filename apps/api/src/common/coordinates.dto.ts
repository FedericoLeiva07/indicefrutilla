import { SEARCH_RADIUS_M } from '@indice/shared';
import { Type } from 'class-transformer';
import { IsInt, IsLatitude, IsLongitude, IsOptional, Max, Min } from 'class-validator';

export class PointQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;
}

export class RadiusQueryDto extends PointQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(SEARCH_RADIUS_M.min)
  @Max(SEARCH_RADIUS_M.max)
  radius: number = SEARCH_RADIUS_M.default;
}
