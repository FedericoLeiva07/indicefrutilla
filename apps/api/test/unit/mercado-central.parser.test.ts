import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  dateFromFileName,
  extractDailyFiles,
  parseDailyFile,
} from '../../src/modules/reference/import/mercado-central.parser';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(__dirname, '..', 'fixtures', 'mercado-central', name)));

const HEADER = [
  'ESP',
  'VAR',
  'PROC',
  'ENV',
  'KG',
  'CAL',
  'TAM',
  'GRADO',
  'MA010126',
  'MO010126',
  'MI010126',
  'MAPK',
  'MOPK',
  'MIPK',
];

function xls(rows: unknown[][]): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADER, ...rows]), 'Sheet1');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'biff8' }) as ArrayBuffer);
}

describe('dateFromFileName', () => {
  it('lee RFddmmyy', () => {
    expect(dateFromFileName('RF040926.XLS')).toBe('2026-09-04');
    expect(dateFromFileName('dir/rf311226.xls')).toBe('2026-12-31');
  });

  it('rechaza fechas imposibles y otros nombres', () => {
    expect(dateFromFileName('RF310226.XLS')).toBeNull();
    expect(dateFromFileName('RH040926.XLS')).toBeNull();
  });
});

describe('parseDailyFile', () => {
  it('lee las filas de frutilla de un archivo real del Mercado Central', () => {
    const rows = parseDailyFile({ name: 'RF040926.XLS', data: fixture('RF040926.XLS') });
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.date === '2026-09-04' && r.sourceFile === 'RF040926.XLS')).toBe(
      true,
    );
    expect(rows).toContainEqual({
      date: '2026-09-04',
      origin: 'TUCUMAN',
      package: 'CA',
      kg: 5,
      quality: 'EL',
      size: 'GRANEL',
      minPpk: 3400,
      modalPpk: 3800,
      maxPpk: 44000,
      sourceFile: 'RF040926.XLS',
    });
  });

  it('descarta el promedio de la especie y las filas con MOPK fuera de [MIPK, MAPK]', () => {
    const rows = parseDailyFile({
      name: 'RF010126.XLS',
      data: xls([
        [
          'FRUTILLA',
          '',
          'TUCUMAN',
          'CA',
          2,
          'EL',
          'GRANEL',
          '',
          10000,
          9000,
          8000,
          5000,
          4500,
          4000,
        ],
        ['FRUTILLA', 'Prom.Esp.', '', '', 0, '', '', '', 0, 9000, 0, 0, 4500, 0],
        [
          'FRUTILLA',
          '',
          'SANTA FE',
          'CA',
          2,
          'EL',
          'GRANEL',
          '',
          10000,
          9000,
          8000,
          5000,
          5100,
          4000,
        ],
        ['FRUTILLA', '', 'CTES.', 'BA', 2, 'EL', 'GRANEL', '', 10000, 9000, 8000, 5000, 3900, 4000],
        [
          'FRUTILLA',
          '',
          'BS. AS.',
          'BA',
          0,
          'EL',
          'GRANEL',
          '',
          10000,
          9000,
          8000,
          5000,
          4500,
          4000,
        ],
        ['ANANA', 'PIÑA', 'BRASIL', 'CA', 18, 'EL', '010/012', '', 1, 1, 1, 1, 1, 1],
        [
          ' frutilla ',
          '',
          'TUCUMAN',
          'CA',
          5,
          'EL',
          'GRANDE',
          '',
          20000,
          19000,
          17000,
          4000,
          '3800',
          3400,
        ],
      ]),
    });
    expect(rows.map((r) => [r.origin, r.kg, r.modalPpk])).toEqual([
      ['TUCUMAN', 2, 4500],
      ['TUCUMAN', 5, 3800],
    ]);
  });

  it('falla si faltan columnas', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['ESP', 'VAR']]), 'Sheet1');
    const data = new Uint8Array(
      XLSX.write(wb, { type: 'array', bookType: 'biff8' }) as ArrayBuffer,
    );
    expect(() => parseDailyFile({ name: 'RF010126.XLS', data })).toThrow(/faltan columnas PROC/);
  });
});

describe('extractDailyFiles', () => {
  it('toma solo los RF*.XLS e ignora .rar y ZIP anidados', () => {
    const zip = zipSync({
      'RF300926.XLS': new Uint8Array([1]),
      'carpeta/RF010926.xls': new Uint8Array([2]),
      'FRUTAS_SEPTIEMBRE_26.rar': new Uint8Array([3]),
      'otro.zip': zipSync({ 'RF020926.XLS': new Uint8Array([4]) }),
      'RH010926.XLS': new Uint8Array([5]),
    });
    expect(extractDailyFiles(zip)).toEqual([
      { name: 'RF010926.xls', data: new Uint8Array([2]) },
      { name: 'RF300926.XLS', data: new Uint8Array([1]) },
    ]);
  });
});
