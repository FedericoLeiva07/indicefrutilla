import { FlagReason } from '@indice/shared';
import { IsIn } from 'class-validator';

export class VoteDto {
  @IsIn([1, -1])
  value: 1 | -1;
}

export class FlagDto {
  @IsIn(Object.values(FlagReason))
  reason: FlagReason;
}
