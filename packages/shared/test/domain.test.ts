import { describe, expect, it } from 'vitest';
import { pricePerKg, resolveQuantityG } from '../src/domain.js';

describe('resolveQuantityG', () => {
  it('usa el peso fijo de las presentaciones conocidas', () => {
    expect(resolveQuantityG('g250')).toBe(250);
    expect(resolveQuantityG('g500', 9999)).toBe(500);
    expect(resolveQuantityG('kg1')).toBe(1000);
  });

  it('exige la cantidad para cajón y otro', () => {
    expect(resolveQuantityG('cajon')).toBeNull();
    expect(resolveQuantityG('cajon', 2000)).toBe(2000);
    expect(resolveQuantityG('otro', 300)).toBe(300);
  });

  it('rechaza cantidades fuera de rango', () => {
    expect(resolveQuantityG('cajon', 500)).toBeNull();
    expect(resolveQuantityG('cajon', 12000)).toBeNull();
    expect(resolveQuantityG('otro', 10)).toBeNull();
  });
});

describe('pricePerKg', () => {
  it('normaliza a $/kg', () => {
    expect(pricePerKg(2300, 500)).toBe(4600);
    expect(pricePerKg(9200, 2000)).toBe(4600);
    expect(pricePerKg(1100, 250)).toBe(4400);
  });

  it('redondea a centavos', () => {
    expect(pricePerKg(1000, 300)).toBe(3333.33);
  });
});
