import type { IndexLevel } from './domain.js';
import type { ReferenceLatestDto } from './reference.js';

export interface IndexLevelDto {
  level: IndexLevel;
  id: string;
  name: string;
  published: boolean;
  medianPpk: number | null;
  p25Ppk: number | null;
  p75Ppk: number | null;
  sampleSize: number;
  storeCount: number;
  weeklyChangePct: number | null;
}

export interface IndexHistoryPointDto {
  weekStart: string;
  medianPpk: number | null;
}

export interface IndexSummaryDto {
  weekStart: string;
  levels: IndexLevelDto[];
  shown: IndexLevelDto | null;
  history: IndexHistoryPointDto[];
  reference: ReferenceLatestDto;
}
