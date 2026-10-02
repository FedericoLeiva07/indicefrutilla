import type { IndexLevel, Presentation, Quality } from './domain.js';

export interface CreateReportRequest {
  storeId: number;
  priceArs: number;
  presentation: Presentation;
  quantityG?: number;
  quality: Quality;
  observedAt: string;
  reporterName?: string;
  turnstileToken: string;
}

export interface CreateReportResponse {
  report: { id: number; pricePerKg: number };
  zone: { level: IndexLevel; id: string; name: string };
  comparison: { zoneMedian: number; diffPct: number } | null;
}

export interface PriceOutOfRangeDetails {
  plausibleMin: number;
  plausibleMax: number;
  pricePerKg: number;
}

export interface ReportItemDto {
  id: number;
  store: { id: number; name: string; address: string; location: { lat: number; lng: number } };
  priceArs: number;
  presentation: Presentation;
  quantityG: number;
  pricePerKg: number;
  quality: Quality;
  observedAt: string;
  createdAt: string;
  reporterName: string | null;
  distanceM: number | null;
  votes: ReportVotesDto;
  myVote: VoteValue | null;
}

export type VoteValue = 1 | -1;

export interface ReportVotesDto {
  up: number;
  down: number;
}

export interface VoteResponse {
  votes: ReportVotesDto;
  myVote: VoteValue;
  active: boolean;
}

export interface FlagResponse {
  hidden: boolean;
}

export interface ReportListDto {
  items: ReportItemDto[];
  total: number;
  nextCursor: string | null;
}

export type ReportUnavailableReason = 'flagged' | 'expired' | 'downvoted';

export interface ReportUnavailableDetails {
  reason: ReportUnavailableReason;
}
