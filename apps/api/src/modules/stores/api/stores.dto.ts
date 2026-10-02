import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RadiusQueryDto } from '../../../common/coordinates.dto';
import { Trim } from '../../../common/transforms';
import { STORE_NAME_MAX_LENGTH } from '../domain/normalize-name';

export class NearbyStoresQueryDto extends RadiusQueryDto {}

export class SearchStoresQueryDto extends RadiusQueryDto {
  @Trim()
  @IsString()
  @Length(2, STORE_NAME_MAX_LENGTH)
  q: string;
}

export class CreateStoreDto {
  @Trim()
  @IsString()
  @Length(2, STORE_NAME_MAX_LENGTH)
  name: string;

  @Trim()
  @IsString()
  @Length(3, 120)
  address: string;

  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @IsOptional()
  @IsBoolean()
  confirmedDistinct?: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  turnstileToken: string;
}
