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
