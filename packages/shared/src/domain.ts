export const Presentation = {
  G250: 'g250',
  G500: 'g500',
  Kg1: 'kg1',
  Cajon: 'cajon',
  Otro: 'otro',
} as const;

export type Presentation = (typeof Presentation)[keyof typeof Presentation];

export const Quality = {
  Primera: 'primera',
  Segunda: 'segunda',
} as const;

export type Quality = (typeof Quality)[keyof typeof Quality];

export const FIXED_PRESENTATION_GRAMS: Partial<Record<Presentation, number>> = {
  g250: 250,
  g500: 500,
  kg1: 1000,
};

export const QUANTITY_LIMITS_G = {
  cajon: { min: 1000, max: 10000 },
  otro: { min: 50, max: 10000 },
} as const;

export const PRICE_ARS_LIMITS = { min: 1, max: 10_000_000 } as const;

export function resolveQuantityG(
  presentation: Presentation,
  quantityG?: number | null,
): number | null {
  const fixed = FIXED_PRESENTATION_GRAMS[presentation];
  if (fixed !== undefined) return fixed;
  if (presentation !== 'cajon' && presentation !== 'otro') return null;
  const limits = QUANTITY_LIMITS_G[presentation];
  if (quantityG == null || !Number.isFinite(quantityG)) return null;
  if (quantityG < limits.min || quantityG > limits.max) return null;
  return quantityG;
}

export function pricePerKg(priceArs: number, quantityG: number): number {
  return Math.round((priceArs / (quantityG / 1000)) * 100) / 100;
}

export const ReportStatus = {
  Active: 'active',
  Flagged: 'flagged',
} as const;

export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const IndexLevel = {
  Department: 'department',
  Province: 'province',
  Country: 'country',
} as const;

export type IndexLevel = (typeof IndexLevel)[keyof typeof IndexLevel];

export const SEARCH_RADIUS_M = { min: 100, max: 20_000, default: 3_000 } as const;

export const REPORTER_NAME_MAX_LENGTH = 30;

export const OBSERVED_AT_MAX_DAYS_AGO = 2;
