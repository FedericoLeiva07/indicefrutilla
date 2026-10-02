import type { ReportItemDto } from '@indice/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { OfferSheet } from './OfferSheet';

const voteReport = vi.fn();
const flagReport = vi.fn();
const detail = vi.fn();

vi.mock('../lib/community-api', () => ({
  voteReport: (...a: unknown[]) => voteReport(...a),
  flagReport: (...a: unknown[]) => flagReport(...a),
  useReportDetail: () => detail(),
}));

const report: ReportItemDto = {
  id: 5,
  store: {
    id: 1,
    name: 'Frutería La Esquina',
    address: 'Av. San Martín 2850',
    location: { lat: -34.6, lng: -58.56 },
  },
  priceArs: 1100,
  presentation: 'g250',
  quantityG: 250,
  pricePerKg: 4400,
  quality: 'primera',
  observedAt: '2026-10-02',
  createdAt: '2026-10-02T12:00:00Z',
  reporterName: null,
  distanceM: 450,
  votes: { up: 12, down: 0 },
  myVote: null,
};

function renderSheet() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <OfferSheet report={report} onClose={() => undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

describe('OfferSheet', () => {
  beforeEach(() => {
    detail.mockReturnValue({ data: report, error: null });
    voteReport.mockReset();
    flagReport.mockReset();
  });

  afterEach(cleanup);

  it('registra el voto, actualiza el contador y deshabilita los botones (E7)', async () => {
    voteReport.mockResolvedValue({ votes: { up: 13, down: 0 }, myVote: 1, active: true });
    renderSheet();
    await click('Sigue (12)');
    expect(voteReport).toHaveBeenCalledWith(5, 1);
    expect(screen.getByText('Gracias, confirmaste que el precio sigue')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Sigue (13)' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('button', { name: 'Ya no está' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText('Ya votaste esta oferta desde este dispositivo')).toBeTruthy();
  });

  it('con ALREADY_VOTED muestra el estado votado (E7)', async () => {
    voteReport.mockRejectedValue(
      new ApiError('ALREADY_VOTED', 409, 'x', { votes: { up: 12, down: 3 }, myVote: -1 }),
    );
    renderSheet();
    await click('Ya no está');
    expect(
      screen.getByRole('button', { name: 'Ya no está (3)' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByText('Ya votaste esta oferta desde este dispositivo')).toBeTruthy();
  });

  it('envía la denuncia con el motivo elegido (E8)', async () => {
    flagReport.mockResolvedValue({ hidden: false });
    renderSheet();
    await click('Denunciar esta oferta');
    fireEvent.click(screen.getByRole('radio', { name: 'Está duplicada' }));
    await click('Enviar denuncia');
    expect(flagReport).toHaveBeenCalledWith(5, 'duplicada');
    expect(screen.getByText(/Con 3 denuncias de dispositivos distintos/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Denunciar esta oferta' })).toBeNull();
  });

  it('explica que la oferta ya no está disponible (E9)', () => {
    detail.mockReturnValue({
      data: undefined,
      error: new ApiError('REPORT_UNAVAILABLE', 410, 'x', { reason: 'downvoted' }),
    });
    renderSheet();
    expect(screen.getByText('Esta oferta ya no está disponible')).toBeTruthy();
    expect(screen.getByText('La comunidad marcó que ya no está')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver otras ofertas cerca' })).toBeTruthy();
  });
});
