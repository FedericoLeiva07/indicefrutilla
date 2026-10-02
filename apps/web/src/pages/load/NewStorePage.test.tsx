import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import { DraftProvider } from '../../lib/draft-context';
import { saveLocation } from '../../lib/location';
import { LocationProvider } from '../../lib/location-context';
import { NewStorePage } from './NewStorePage';

const createStore = vi.fn();

vi.mock('../../lib/load-api', () => ({
  createStore: (...args: unknown[]) => createStore(...args),
  roundStorePin: (v: number) => Math.round(v * 10_000) / 10_000,
}));

vi.mock('../../components/PinPicker', () => ({ PinPicker: () => <div>mapa</div> }));

const candidate = {
  id: 42,
  name: 'Verdulería Don Tito',
  address: 'Valentín Gómez 4720',
  location: { lat: -34.6071, lng: -58.5648 },
  distanceM: 20,
  reportCount: 14,
};

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <LocationProvider>
        <MemoryRouter initialEntries={['/cargar/comercio-nuevo?nombre=Don%20Tito%20verdu']}>
          <DraftProvider>
            <Routes>
              <Route path="/cargar/comercio-nuevo" element={<NewStorePage />} />
              <Route path="/cargar/precio" element={<p>Paso 2</p>} />
            </Routes>
          </DraftProvider>
        </MemoryRouter>
      </LocationProvider>
    </QueryClientProvider>,
  );
}

async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

describe('NewStorePage (C2)', () => {
  beforeEach(() => {
    saveLocation({
      kind: 'point',
      source: 'gps',
      lat: -34.60712,
      lng: -58.56481,
      radius: 3000,
      provinceId: '06',
      departmentId: '06840',
      label: 'Tres de Febrero',
    });
    createStore.mockReset();
    createStore.mockRejectedValueOnce(
      new ApiError('STORE_POSSIBLE_DUPLICATE', 409, 'x', { candidates: [candidate] }),
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  async function submitDuplicate() {
    renderPage();
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Don Tito verdu');
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Av. Urquiza 4100' } });
    await click('Guardar y continuar');
    expect(screen.getByText(/Encontramos un comercio parecido a 20 m/)).toBeTruthy();
    expect(screen.getByText(/Valentín Gómez 4720 · a 20 m · 14 ofertas/)).toBeTruthy();
  }

  it('"Es este" usa el candidato', async () => {
    await submitDuplicate();
    await click('Es este');
    expect(screen.getByText('Paso 2')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('indice.draft.v1')!).store).toMatchObject({ id: 42 });
    expect(createStore).toHaveBeenCalledOnce();
  });

  it('"No, es otro" reenvía con confirmedDistinct y la misma clave', async () => {
    await submitDuplicate();
    createStore.mockResolvedValueOnce({ ...candidate, id: 99, name: 'Don Tito verdu' });
    await click('No, es otro comercio');
    expect(createStore).toHaveBeenCalledTimes(2);
    const [first, second] = createStore.mock.calls;
    expect(first![0]).toEqual({
      name: 'Don Tito verdu',
      address: 'Av. Urquiza 4100',
      lat: -34.6071,
      lng: -58.5648,
    });
    expect(second![0]).toEqual({ ...first![0], confirmedDistinct: true });
    expect(second![1]).toBe(first![1]);
    expect(screen.getByText('Paso 2')).toBeTruthy();
  });
});
