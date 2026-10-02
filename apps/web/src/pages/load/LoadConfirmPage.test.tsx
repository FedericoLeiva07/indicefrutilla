import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import { newDraft, saveDraft } from '../../lib/draft';
import { DraftProvider } from '../../lib/draft-context';
import { saveLocation } from '../../lib/location';
import { LocationProvider } from '../../lib/location-context';
import { LoadConfirmPage } from './LoadConfirmPage';

const createReport = vi.fn();

vi.mock('../../lib/load-api', () => ({
  createReport: (...args: unknown[]) => createReport(...args),
}));

vi.mock('../../lib/queries', () => ({
  useIndexSummary: () => ({ data: undefined }),
}));

const draft = {
  ...newDraft(),
  store: {
    id: 7,
    name: 'Verdulería Don Tito',
    address: 'Valentín Gómez 4720',
    location: { lat: -34.6, lng: -58.56 },
  },
  priceText: '9.200',
  presentation: 'cajon' as const,
  cajonKg: '2' as const,
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
};

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <LocationProvider>
        <MemoryRouter initialEntries={['/cargar/confirmar']}>
          <DraftProvider>
            <Routes>
              <Route path="/cargar/confirmar" element={<LoadConfirmPage />} />
              <Route path="/cargar/precio" element={<p>Paso 2</p>} />
              <Route path="/cargar/listo" element={<p>Publicado</p>} />
            </Routes>
          </DraftProvider>
        </MemoryRouter>
      </LocationProvider>
    </QueryClientProvider>,
  );
}

async function publish() {
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: /Publicar precio|Reintentar publicar|Intentar de nuevo/ }),
    );
  });
}

describe('LoadConfirmPage', () => {
  beforeEach(() => {
    saveLocation({
      kind: 'point',
      source: 'zone',
      lat: -34.6,
      lng: -58.56,
      radius: 3000,
      provinceId: '06',
      departmentId: '06840',
      label: 'Caseros',
    });
    saveDraft(draft);
    createReport.mockReset();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.useRealTimers();
  });

  it('envía el cuerpo del spec y muestra el éxito (C6)', async () => {
    createReport.mockResolvedValue({
      report: { id: 1, pricePerKg: 4600 },
      zone: { level: 'department', id: '06840', name: 'Tres de Febrero' },
      comparison: null,
    });
    renderPage();
    await publish();
    expect(createReport).toHaveBeenCalledWith(
      {
        storeId: 7,
        priceArs: 9200,
        presentation: 'cajon',
        quantityG: 2000,
        quality: 'primera',
        observedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
      draft.idempotencyKey,
    );
    expect(screen.getByText('Publicado')).toBeTruthy();
    expect(localStorage.getItem('indice.draft.v1')).toBeNull();
  });

  it('guarda el nombre y lo manda recortado', async () => {
    createReport.mockResolvedValue({
      report: { id: 1, pricePerKg: 4600 },
      zone: { level: 'department', id: '1', name: 'x' },
      comparison: null,
    });
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: /Con un nombre/ }));
    fireEvent.change(screen.getByLabelText('Nombre o apodo'), { target: { value: '  Fede  ' } });
    await publish();
    expect(createReport.mock.calls[0]![0]).toMatchObject({ reporterName: 'Fede' });
    expect(localStorage.getItem('indice.name.v1')).toBe('"Fede"');
  });

  it('cuenta hacia atrás con RATE_LIMITED y después reintenta (C9)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    createReport.mockRejectedValueOnce(new ApiError('RATE_LIMITED', 429, 'x', undefined, 2));
    renderPage();
    await publish();
    const retry = screen.getByRole('button', { name: /Reintentar en 0:02/ });
    expect((retry as HTMLButtonElement).disabled).toBe(true);
    for (let i = 0; i < 2; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect((screen.getByRole('button', { name: 'Reintentar' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('muestra el límite diario sin reintento (C10)', async () => {
    createReport.mockRejectedValueOnce(
      new ApiError('DAILY_LIMIT_REACHED', 429, 'x', undefined, 3600),
    );
    renderPage();
    await publish();
    expect(screen.getByText('Llegaste al máximo de hoy')).toBeTruthy();
    expect(screen.getByText('Se renueva a las 00:00')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Reintentar/ })).toBeNull();
  });

  it('reintenta la verificación con la misma clave (C11)', async () => {
    createReport
      .mockRejectedValueOnce(new ApiError('TURNSTILE_FAILED', 403, 'x'))
      .mockResolvedValueOnce({
        report: { id: 1, pricePerKg: 4600 },
        zone: { level: 'department', id: '1', name: 'x' },
        comparison: null,
      });
    renderPage();
    await publish();
    expect(screen.getByText('No pudimos verificar que sos una persona')).toBeTruthy();
    await publish();
    expect(createReport).toHaveBeenCalledTimes(2);
    expect(createReport.mock.calls[1]![1]).toBe(draft.idempotencyKey);
    expect(screen.getByText('Publicado')).toBeTruthy();
  });

  it('conserva el borrador ante un error de red y reintenta con la misma clave (C12)', async () => {
    createReport.mockRejectedValueOnce(new ApiError('NETWORK', null, 'x'));
    renderPage();
    await publish();
    expect(screen.getByText(/Se cortó la conexión/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('indice.draft.v1')!).idempotencyKey).toBe(
      draft.idempotencyKey,
    );
    createReport.mockRejectedValueOnce(new ApiError('INTERNAL', 503, 'x'));
    await publish();
    expect(screen.getByText(/Tuvimos un problema de nuestro lado \(E-503\)/)).toBeTruthy();
    expect(createReport.mock.calls.map((c) => c[1])).toEqual([
      draft.idempotencyKey,
      draft.idempotencyKey,
    ]);
  });

  it('vuelve al paso 2 con PRICE_OUT_OF_RANGE (C4)', async () => {
    createReport.mockRejectedValueOnce(
      new ApiError('PRICE_OUT_OF_RANGE', 422, 'x', {
        plausibleMin: 3000,
        plausibleMax: 16000,
        pricePerKg: 50000,
      }),
    );
    renderPage();
    await publish();
    expect(screen.getByText('Paso 2')).toBeTruthy();
  });
});
