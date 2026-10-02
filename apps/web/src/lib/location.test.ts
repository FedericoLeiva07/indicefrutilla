import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLocation, roundCoord, saveLocation, summaryZone } from './location';

const caseros = {
  kind: 'point' as const,
  source: 'gps' as const,
  lat: -34.604,
  lng: -58.563,
  radius: 3000,
  provinceId: '06',
  departmentId: '06840',
  label: 'Tres de Febrero',
};

describe('location', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('redondea a 3 decimales', () => {
    expect(roundCoord(-34.60412)).toBe(-34.604);
    expect(roundCoord(-58.56271)).toBe(-58.563);
  });

  it('guarda y recupera la ubicación con la clave del spec', () => {
    saveLocation(caseros);
    expect(JSON.parse(localStorage.getItem('indice.location.v1')!)).toEqual(caseros);
    expect(loadLocation()).toEqual(caseros);
  });

  it('descarta valores corruptos', () => {
    localStorage.setItem('indice.location.v1', '{"kind":"point","lat":"x"}');
    expect(loadLocation()).toBeNull();
    localStorage.setItem('indice.location.v1', 'no es json');
    expect(loadLocation()).toBeNull();
  });

  it('funciona sin localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => saveLocation(caseros)).not.toThrow();
    expect(loadLocation()).toBeNull();
  });

  it('elige la zona del índice', () => {
    expect(summaryZone(caseros)).toEqual({ departmentId: '06840' });
    expect(summaryZone({ ...caseros, departmentId: null })).toEqual({ provinceId: '06' });
    expect(summaryZone({ kind: 'country' })).toEqual({});
  });
});
