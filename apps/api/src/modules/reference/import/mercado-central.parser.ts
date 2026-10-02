import { isIsoDate } from '@indice/shared';
import { unzipSync } from 'fflate';
import * as XLSX from 'xlsx';

export interface ReferencePriceRow {
  date: string;
  origin: string;
  package: string;
  kg: number;
  quality: string;
  size: string;
  minPpk: number;
  modalPpk: number;
  maxPpk: number;
  sourceFile: string;
}

export interface DailyFile {
  name: string;
  data: Uint8Array;
}

const DAILY_FILE = /^RF(\d{2})(\d{2})(\d{2})\.XLS$/i;
const REQUIRED_COLUMNS = ['ESP', 'VAR', 'PROC', 'ENV', 'KG', 'CAL', 'TAM', 'MAPK', 'MOPK', 'MIPK'];

export function extractDailyFiles(zip: Uint8Array): DailyFile[] {
  const entries = unzipSync(zip, { filter: (f) => DAILY_FILE.test(baseName(f.name)) });
  return Object.entries(entries)
    .map(([name, data]) => ({ name: baseName(name), data }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function dateFromFileName(fileName: string): string | null {
  const m = DAILY_FILE.exec(baseName(fileName));
  if (!m) return null;
  const date = `20${m[3]}-${m[2]}-${m[1]}`;
  return isIsoDate(date) ? date : null;
}

export function parseDailyFile(file: DailyFile): ReferencePriceRow[] {
  const date = dateFromFileName(file.name);
  if (!date) throw new Error(`Nombre de archivo inesperado: ${file.name}`);

  const workbook = XLSX.read(file.data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
  if (!sheet) throw new Error(`${file.name} no tiene hojas`);
  const [header, ...rows] = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const columns = (header ?? []).map((h) =>
    String(h ?? '')
      .trim()
      .toUpperCase(),
  );
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length > 0) throw new Error(`${file.name}: faltan columnas ${missing.join(', ')}`);
  const col = (row: unknown[], name: string) => row[columns.indexOf(name)];

  const result: ReferencePriceRow[] = [];
  for (const row of rows) {
    if (text(col(row, 'ESP')).toUpperCase() !== 'FRUTILLA') continue;
    if (text(col(row, 'VAR')).toUpperCase() === 'PROM.ESP.') continue;
    const minPpk = num(col(row, 'MIPK'));
    const modalPpk = num(col(row, 'MOPK'));
    const maxPpk = num(col(row, 'MAPK'));
    const kg = num(col(row, 'KG'));
    if (minPpk === null || modalPpk === null || maxPpk === null || kg === null) continue;
    if (modalPpk <= 0 || kg <= 0 || modalPpk < minPpk || modalPpk > maxPpk) continue;
    result.push({
      date,
      origin: text(col(row, 'PROC')).slice(0, 50),
      package: text(col(row, 'ENV')).slice(0, 10),
      kg,
      quality: text(col(row, 'CAL')).slice(0, 10),
      size: text(col(row, 'TAM')).slice(0, 30),
      minPpk,
      modalPpk,
      maxPpk,
      sourceFile: file.name,
    });
  }
  return result;
}

export function referenceRowKey(r: ReferencePriceRow): string {
  return [r.date, r.origin, r.package, r.kg, r.quality, r.size].join('|');
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
