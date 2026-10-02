import {
  argentinaDate,
  OBSERVED_AT_MAX_DAYS_AGO,
  PRICE_ARS_LIMITS,
  type Presentation,
  pricePerKg,
  type Quality,
  QUANTITY_LIMITS_G,
  resolveQuantityG,
  shiftDate,
} from '@indice/shared';
import type { ReportItemDto } from '@indice/shared';
import { readJson, removeKey, writeJson } from './storage';

export interface DraftStore {
  id: number;
  name: string;
  address: string;
  location: { lat: number; lng: number };
}

export type CajonKg = '2' | '4' | '5' | 'otro';

export interface Draft {
  store: DraftStore | null;
  priceText: string;
  presentation: Presentation | null;
  cajonKg: CajonKg | null;
  cajonOtherKg: string;
  otherGrams: string;
  quality: Quality;
  daysAgo: number;
  idempotencyKey: string;
}

export type DraftField = 'priceArs' | 'presentation' | 'quantityG';

export interface DraftError {
  field: DraftField;
  message: string;
}

const DRAFT_KEY = 'draft.v1';
const NAME_KEY = 'name.v1';

export const CAJON_KG_OPTIONS: CajonKg[] = ['2', '4', '5'];

export const DAYS_AGO_OPTIONS = Array.from({ length: OBSERVED_AT_MAX_DAYS_AGO + 1 }, (_, i) => i);

export function newDraft(): Draft {
  return {
    store: null,
    priceText: '',
    presentation: null,
    cajonKg: null,
    cajonOtherKg: '',
    otherGrams: '',
    quality: 'primera',
    daysAgo: 0,
    idempotencyKey: crypto.randomUUID(),
  };
}

export type ReportPrefill = Pick<ReportItemDto, 'store' | 'presentation' | 'quantityG' | 'quality'>;

export function draftFromReport(report: ReportPrefill): Draft {
  const { id, name, address, location } = report.store;
  const draft: Draft = {
    ...newDraft(),
    store: { id, name, address, location },
    presentation: report.presentation,
    quality: report.quality,
  };
  if (report.presentation === 'cajon') {
    const kg = String(report.quantityG / 1000) as CajonKg;
    if (CAJON_KG_OPTIONS.includes(kg)) draft.cajonKg = kg;
    else {
      draft.cajonKg = 'otro';
      draft.cajonOtherKg = String(report.quantityG / 1000).replace('.', ',');
    }
  }
  if (report.presentation === 'otro') draft.otherGrams = String(report.quantityG);
  return draft;
}

export function loadDraft(): Draft | null {
  const draft = readJson<Draft>(DRAFT_KEY);
  if (!draft || typeof draft.idempotencyKey !== 'string') return null;
  return { ...newDraft(), ...draft };
}

export function saveDraft(draft: Draft): void {
  writeJson(DRAFT_KEY, draft);
}

export function clearDraft(): void {
  removeKey(DRAFT_KEY);
}

export function loadName(): string {
  const name = readJson<string>(NAME_KEY);
  return typeof name === 'string' ? name : '';
}

export function saveName(name: string): void {
  writeJson(NAME_KEY, name);
}

export function formatPriceInput(raw: string): string {
  const cleaned = raw.replace(/[^\d,]/g, '');
  const [intPart = '', ...rest] = cleaned.split(',');
  const digits = intPart.replace(/^0+(?=\d)/, '');
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (rest.length === 0) return grouped;
  return `${grouped},${rest.join('').slice(0, 2)}`;
}

export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(/\./g, '').replace(',', '.');
  if (normalized === '' || !/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

export function parseKg(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '' || !/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

export function draftQuantityG(draft: Draft): number | null {
  if (!draft.presentation) return null;
  if (draft.presentation === 'cajon') {
    if (!draft.cajonKg) return null;
    const kg = draft.cajonKg === 'otro' ? parseKg(draft.cajonOtherKg) : Number(draft.cajonKg);
    return kg === null ? null : resolveQuantityG('cajon', Math.round(kg * 1000));
  }
  if (draft.presentation === 'otro') {
    const grams = parseDecimal(draft.otherGrams);
    return grams === null || !Number.isInteger(grams) ? null : resolveQuantityG('otro', grams);
  }
  return resolveQuantityG(draft.presentation);
}

export function draftPricePerKg(draft: Draft): number | null {
  const price = parseDecimal(draft.priceText);
  const grams = draftQuantityG(draft);
  if (price === null || price <= 0 || grams === null) return null;
  return pricePerKg(price, grams);
}

export function observedAt(daysAgo: number, now: Date = new Date()): string {
  return shiftDate(argentinaDate(now), -daysAgo);
}

export function validateDraft(draft: Draft): DraftError[] {
  const errors: DraftError[] = [];
  const price = parseDecimal(draft.priceText);
  if (price === null || price < PRICE_ARS_LIMITS.min) {
    errors.push({ field: 'priceArs', message: 'Ingresá el precio que figura en el cartel' });
  } else if (price > PRICE_ARS_LIMITS.max) {
    errors.push({ field: 'priceArs', message: 'El precio es demasiado alto' });
  }
  if (!draft.presentation) {
    errors.push({ field: 'presentation', message: 'Elegí la presentación' });
  } else if (draft.presentation === 'cajon') {
    if (!draft.cajonKg || (draft.cajonKg === 'otro' && draft.cajonOtherKg.trim() === '')) {
      errors.push({
        field: 'quantityG',
        message: 'Indicá los kilos del cajón para calcular el precio por kg',
      });
    } else if (draftQuantityG(draft) === null) {
      const { min, max } = QUANTITY_LIMITS_G.cajon;
      errors.push({
        field: 'quantityG',
        message: `El cajón tiene que ser de ${min / 1000} a ${max / 1000} kg`,
      });
    }
  } else if (draft.presentation === 'otro' && draftQuantityG(draft) === null) {
    errors.push({ field: 'quantityG', message: 'Ingresá los gramos, de 50 a 10.000' });
  }
  return errors;
}

export function serverFieldErrors(details: unknown): DraftError[] {
  if (!Array.isArray(details)) return [];
  const messages: Record<string, DraftError> = {
    priceArs: { field: 'priceArs', message: 'Revisá el precio' },
    presentation: { field: 'presentation', message: 'Elegí la presentación' },
    quantityG: { field: 'quantityG', message: 'Revisá la cantidad' },
  };
  return details
    .map((d: { field?: string }) => (d.field ? messages[d.field] : undefined))
    .filter((e): e is DraftError => !!e);
}
