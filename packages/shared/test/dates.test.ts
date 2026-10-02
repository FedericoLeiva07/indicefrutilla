import { describe, expect, it } from 'vitest';
import { argentinaDate, isIsoDate, shiftDate, weekStart } from '../src/dates.js';

describe('argentinaDate', () => {
  it('usa la fecha de Argentina y no la de UTC', () => {
    expect(argentinaDate(new Date('2026-10-02T02:30:00Z'))).toBe('2026-10-01');
    expect(argentinaDate(new Date('2026-10-02T03:00:00Z'))).toBe('2026-10-02');
  });
});

describe('shiftDate', () => {
  it('cruza meses y años', () => {
    expect(shiftDate('2026-10-01', -2)).toBe('2026-09-29');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('weekStart', () => {
  it('devuelve el lunes de la semana', () => {
    expect(weekStart('2026-10-01')).toBe('2026-09-28');
    expect(weekStart('2026-09-28')).toBe('2026-09-28');
    expect(weekStart('2026-10-04')).toBe('2026-09-28');
  });
});

describe('isIsoDate', () => {
  it('acepta solo fechas reales en formato YYYY-MM-DD', () => {
    expect(isIsoDate('2026-10-01')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('01/10/2026')).toBe(false);
  });
});
