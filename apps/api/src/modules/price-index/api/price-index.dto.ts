import { IsOptional, Matches } from 'class-validator';

export class IndexSummaryQueryDto {
  @IsOptional()
  @Matches(/^\d{5}$/)
  departmentId?: string;

  @IsOptional()
  @Matches(/^\d{2}$/)
  provinceId?: string;
}
