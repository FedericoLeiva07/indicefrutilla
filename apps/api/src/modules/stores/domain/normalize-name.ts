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

const GENERIC_WORDS = new Set([
  'verduleria',
  'fruteria',
  'fruta',
  'frutas',
  'verduras',
  'almacen',
  'mercado',
  'minimercado',
  'super',
  'supermercado',
  'autoservicio',
  'despensa',
  'kiosco',
  'la',
  'el',
  'los',
  'las',
  'de',
  'del',
  'y',
]);

export function storeSearchTerm(query: string): string {
  const normalized = normalizeStoreName(query);
  const specific = normalized
    .split(' ')
    .filter((word) => word && !GENERIC_WORDS.has(word))
    .join(' ');
  return specific || normalized;
}
