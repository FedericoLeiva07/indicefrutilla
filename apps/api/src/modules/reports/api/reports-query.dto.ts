import { ReportSort } from '@indice/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { RadiusQueryDto } from '../../../common/coordinates.dto';

export class ListReportsQueryDto extends RadiusQueryDto {
  @IsOptional()
  @IsIn(Object.values(ReportSort))
  sort: ReportSort = ReportSort.Price;

  @IsOptional()
  @Matches(/^\d{1,5}$/)
  cursor?: string;
}

export class ReportParamsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id: number;
}
