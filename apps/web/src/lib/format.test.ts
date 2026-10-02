import { describe, expect, it } from 'vitest';
import {
  formatArs,
  formatDistance,
  offerLine,
  relativeAge,
  relativeObserved,
  weekLabel,
} from './format';

describe('formatArs', () => {
  it('usa separador de miles argentino y redondea', () => {
    expect(formatArs(5200)).toBe('$5.200');
    expect(formatArs(1234567.6)).toBe('$1.234.568');
  });
});

describe('formatDistance', () => {
  it('muestra metros redondeados y kilómetros con coma', () => {
    expect(formatDistance(447)).toBe('450 m');
    expect(formatDistance(3)).toBe('10 m');
    expect(formatDistance(1234)).toBe('1,2 km');
    expect(formatDistance(3000)).toBe('3 km');
  });
});

describe('offerLine', () => {
  it('describe la presentación y el precio pagado', () => {
    expect(offerLine('g250', 250, 1100)).toBe('250 g a $1.100');
    expect(offerLine('kg1', 1000, 5200)).toBe('1 kg a $5.200');
    expect(offerLine('cajon', 2000, 9200)).toBe('Cajón 2 kg a $9.200');
    expect(offerLine('otro', 1250, 6000)).toBe('1.250 g a $6.000');
  });
});

describe('weekLabel', () => {
  it('nombra la semana por su lunes', () => {
    expect(weekLabel('2026-09-28')).toMatch(/^semana del 28 sep/);
  });
});

describe('relativeObserved', () => {
  const now = new Date('2026-10-02T15:00:00Z');

  it('usa la hora de carga para las ofertas de hoy', () => {
    expect(relativeObserved('2026-10-02', '2026-10-02T14:20:00Z', now)).toBe('hace 40 min');
    expect(relativeObserved('2026-10-02', '2026-10-02T12:30:00Z', now)).toBe('hace 2 h');
  });

  it('usa la fecha observada para las anteriores', () => {
    expect(relativeObserved('2026-10-01', '2026-10-02T10:00:00Z', now)).toBe('ayer');
    expect(relativeObserved('2026-09-29', '2026-09-29T10:00:00Z', now)).toBe('hace 3 días');
  });
});

describe('relativeAge', () => {
  it('describe la antigüedad de los datos guardados', () => {
    const now = Date.parse('2026-10-02T15:00:00Z');
    expect(relativeAge(now - 20_000, now)).toBe('hace instantes');
    expect(relativeAge(now - 2 * 3_600_000, now)).toBe('hace 2 h');
    expect(relativeAge(now - 26 * 3_600_000, now)).toBe('hace 1 día');
  });
});
