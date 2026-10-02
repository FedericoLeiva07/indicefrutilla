import { SEARCH_RADIUS_M } from '@indice/shared';
import { readJson, removeKey, writeJson } from './storage';

export const RADIUS_OPTIONS_M = [1_000, 3_000, 5_000, 10_000] as const;
export const PROVINCE_RADIUS_M = SEARCH_RADIUS_M.max;

export interface PointLocation {
  kind: 'point';
  source: 'gps' | 'zone';
  lat: number;
  lng: number;
  radius: number;
  provinceId: string;
  departmentId: string | null;
  label: string;
}

export interface CountryLocation {
  kind: 'country';
}

export type SavedLocation = PointLocation | CountryLocation;

const KEY = 'location.v1';

export function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function loadLocation(): SavedLocation | null {
  const value = readJson<SavedLocation>(KEY);
  if (!value) return null;
  if (value.kind === 'country') return value;
  if (value.kind === 'point' && Number.isFinite(value.lat) && Number.isFinite(value.lng)) {
    return value;
  }
  return null;
}

export function saveLocation(location: SavedLocation): void {
  removeKey(KEY);
  writeJson(KEY, location);
}

export function summaryZone(location: SavedLocation): {
  departmentId?: string;
  provinceId?: string;
} {
  if (location.kind === 'country') return {};
  return location.departmentId
    ? { departmentId: location.departmentId }
    : { provinceId: location.provinceId };
}

export function chipLabel(location: SavedLocation): string {
  if (location.kind === 'country') return 'Todo el país';
  return location.label;
}
