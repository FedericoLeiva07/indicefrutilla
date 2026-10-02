import { ReportFlagEntity } from '../modules/community/infra/report-flag.entity';
import { ReportVoteEntity } from '../modules/community/infra/report-vote.entity';
import { DepartmentEntity } from '../modules/geo/infra/department.entity';
import { LocalityEntity } from '../modules/geo/infra/locality.entity';
import { ProvinceEntity } from '../modules/geo/infra/province.entity';
import { IdempotencyKeyEntity } from '../modules/idempotency/idempotency-key.entity';
import { PriceIndexWeeklyEntity } from '../modules/price-index/infra/price-index-weekly.entity';
import { ReferencePriceEntity } from '../modules/reference/infra/reference-price.entity';
import { ReportEntity } from '../modules/reports/infra/report.entity';
import { StoreEntity } from '../modules/stores/infra/store.entity';

export const entities = [
  ProvinceEntity,
  DepartmentEntity,
  LocalityEntity,
  StoreEntity,
  ReportEntity,
  PriceIndexWeeklyEntity,
  ReferencePriceEntity,
  IdempotencyKeyEntity,
  ReportVoteEntity,
  ReportFlagEntity,
];
