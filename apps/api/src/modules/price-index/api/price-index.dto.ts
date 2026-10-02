import { INDEX_WINDOWS, IndexLevel, type IndexWindow } from '@indice/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class IndexSummaryQueryDto {
  @IsOptional()
  @Matches(/^\d{5}$/)
  departmentId?: string;

  @IsOptional()
  @Matches(/^\d{2}$/)
  provinceId?: string;
}

export class ProvinceIndexQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(INDEX_WINDOWS)
  weeks: IndexWindow = 1;
}

export class IndexHistoryQueryDto {
  @IsIn(Object.values(IndexLevel))
  level: IndexLevel;

  @Matches(/^(AR|\d{2}|\d{5})$/)
  id: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(52)
  weeks: number = 12;
}
