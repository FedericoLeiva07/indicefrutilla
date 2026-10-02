export const REFERENCE_SOURCE = 'Mercado Central de Buenos Aires';

export interface ReferenceLatestDto {
  date: string | null;
  modalPpk: number | null;
  plausibleMin: number;
  plausibleMax: number;
  source: typeof REFERENCE_SOURCE | null;
}
