export const STORE_NAME_MAX_LENGTH = 80;

export function normalizeStoreName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .slice(0, STORE_NAME_MAX_LENGTH);
}
