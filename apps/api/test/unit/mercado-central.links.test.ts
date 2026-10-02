import { describe, expect, it } from 'vitest';
import {
  extractZipLinks,
  selectRecentZips,
  zipMonth,
} from '../../src/modules/reference/import/mercado-central.links';

describe('zipMonth', () => {
  it.each([
    ['FRUTAS-MAYO-2026.zip', 2026, 5],
    ['FRUTAS_ABRIL2026_0.zip', 2026, 4],
    ['FRUTAS_FEBRERO-26_0.zip', 2026, 2],
    ['FRUTAS  ENERO-26_0.zip', 2026, 1],
    ['FRUTA_JUNIO_2026_0.zip', 2026, 6],
    ['FRUTAS_JULIO_26.zip', 2026, 7],
    ['FRUTRAS_AGOSTO-26_0.zip', 2026, 8],
    ['FRUTAS_SEPTIEMBRE_26_0.zip', 2026, 9],
    ['FRUTAS_SETIEMBRE_2026.zip', 2026, 9],
    ['FRUTAS_DICIEMBRE-25.zip', 2025, 12],
  ])('lee el mes de %s', (name, year, month) => {
    expect(zipMonth(name)).toEqual({ year, month });
  });

  it('devuelve null si no puede leer el mes', () => {
    expect(zipMonth('FRUTAS_2026.zip')).toEqual({ year: null, month: null });
    expect(zipMonth('FRUTAS_MAYO.zip')).toEqual({ year: null, month: null });
  });
});

describe('extractZipLinks', () => {
  const page = 'https://mercadocentral.gob.ar/informaci%C3%B3n/precios-mayoristas';

  it('toma solo los ZIP de frutas, resuelve rutas relativas y decodifica el nombre', () => {
    const html = `
      <a href="https://mercadocentral.gob.ar/files/FRUTAS%20%20ENERO-26_0.zip">x</a>
      <a href='/files/FRUTRAS_AGOSTO-26_0.zip'>x</a>
      <a href="/files/HORTALIZA_SEPTIENBRE_26_0.zip">x</a>
      <a href="/files/FRUTAS_ENERO.pdf">x</a>
      <a href="/files/FRUTRAS_AGOSTO-26_0.zip">repetido</a>`;
    expect(extractZipLinks(html, page)).toEqual([
      {
        url: 'https://mercadocentral.gob.ar/files/FRUTAS%20%20ENERO-26_0.zip',
        fileName: 'FRUTAS  ENERO-26_0.zip',
        year: 2026,
        month: 1,
      },
      {
        url: 'https://mercadocentral.gob.ar/files/FRUTRAS_AGOSTO-26_0.zip',
        fileName: 'FRUTRAS_AGOSTO-26_0.zip',
        year: 2026,
        month: 8,
      },
    ]);
  });
});

describe('selectRecentZips', () => {
  const link = (year: number, month: number) => ({
    url: `${year}-${month}`,
    fileName: '',
    year,
    month,
  });
  const links = [link(2025, 12), link(2026, 1), link(2026, 2), link(2026, 10)];

  it('elige el mes actual y el anterior', () => {
    expect(selectRecentZips(links, '2026-02-15').map((l) => l.url)).toEqual(['2026-1', '2026-2']);
  });

  it('cruza el cambio de año', () => {
    expect(selectRecentZips(links, '2026-01-05').map((l) => l.url)).toEqual(['2025-12', '2026-1']);
  });
});
