import type { IndexLevelDto, IndexSummaryDto } from '@indice/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { IndexCard } from './IndexCard';

const level = (overrides: Partial<IndexLevelDto>): IndexLevelDto => ({
  level: 'department',
  id: '06840',
  name: 'Tres de Febrero',
  published: true,
  medianPpk: 5200,
  p25Ppk: 4400,
  p75Ppk: 6100,
  sampleSize: 38,
  storeCount: 12,
  weeklyChangePct: -6,
  ...overrides,
});

const summary = (overrides: Partial<IndexSummaryDto>): IndexSummaryDto => ({
  weekStart: '2026-09-28',
  levels: [level({})],
  shown: level({}),
  history: Array.from({ length: 8 }, (_, i) => ({
    weekStart: `2026-08-${10 + i}`,
    medianPpk: 5000 + i * 50,
  })),
  reference: { date: null, modalPpk: null, plausibleMin: 2000, plausibleMax: 100000, source: null },
  ...overrides,
});

describe('IndexCard', () => {
  afterEach(cleanup);

  it('muestra la mediana publicada con su variación, p25, p75 y muestra (1)', () => {
    render(<IndexCard summary={summary({})} />);
    expect(screen.getByText(/Mediana por kg · semana del 28 sep.* · Tres de Febrero/)).toBeTruthy();
    expect(screen.getByText('$5.200')).toBeTruthy();
    expect(screen.getByText('▼ 6% contra la semana anterior')).toBeTruthy();
    expect(screen.getByText('$4.400')).toBeTruthy();
    expect(screen.getByText('$6.100')).toBeTruthy();
    expect(screen.getByText('38 ofertas')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/últimas 8 semanas/);
  });

  it('sin datos suficientes muestra el conteo y el nivel publicado más chico (E2)', () => {
    const province = level({ level: 'province', id: '06', name: 'Buenos Aires', medianPpk: 5300 });
    render(
      <IndexCard
        summary={summary({
          levels: [level({ published: false, medianPpk: null, sampleSize: 2 }), province],
          shown: province,
        })}
      />,
    );
    expect(screen.getByText('Todavía no hay datos suficientes')).toBeTruthy();
    expect(screen.getByText(/Esta semana hay 2\./)).toBeTruthy();
    expect(screen.getByText('Mientras tanto, Buenos Aires')).toBeTruthy();
    expect(screen.getByText('$5.300 /kg')).toBeTruthy();
  });

  it('sin ningún nivel publicado cae a la referencia mayorista con su fuente', () => {
    render(
      <IndexCard
        summary={summary({
          levels: [level({ published: false, medianPpk: null, sampleSize: 0 })],
          shown: null,
          reference: {
            date: '2026-10-01',
            modalPpk: 4050,
            plausibleMin: 2835,
            plausibleMax: 16200,
            source: 'Mercado Central de Buenos Aires',
          },
        })}
      />,
    );
    expect(screen.getByText(/Esta semana todavía no hay ofertas/)).toBeTruthy();
    expect(
      screen.getByText('Mientras tanto, Mayorista · Mercado Central de Buenos Aires'),
    ).toBeTruthy();
    expect(screen.getByText('$4.050 /kg')).toBeTruthy();
    expect(screen.getByText('Fuente: Mercado Central de Buenos Aires')).toBeTruthy();
  });
});
