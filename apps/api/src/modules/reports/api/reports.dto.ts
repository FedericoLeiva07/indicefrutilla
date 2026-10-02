import { PRICE_ARS_LIMITS, Presentation, Quality, REPORTER_NAME_MAX_LENGTH } from '@indice/shared';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { needsQuantity, QuantityInRange, RecentObservedAt, Required } from './report.validators';

export class CreateReportDto {
  @IsInt()
  @Min(1)
  storeId: number;

  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(PRICE_ARS_LIMITS.min)
  @Max(PRICE_ARS_LIMITS.max)
  priceArs: number;

  @IsIn(Object.values(Presentation))
  presentation: Presentation;

  @ValidateIf(
    (o: CreateReportDto) =>
      needsQuantity(o.presentation) || (o.quantityG !== undefined && o.quantityG !== null),
  )
  @Required()
  @QuantityInRange()
  quantityG?: number;

  @IsIn(Object.values(Quality))
  quality: Quality;

  @RecentObservedAt()
  observedAt: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.trim().slice(0, REPORTER_NAME_MAX_LENGTH) || undefined
      : value,
  )
  @IsString()
  reporterName?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  turnstileToken: string;
}
