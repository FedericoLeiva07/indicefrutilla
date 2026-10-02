import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { ErrorState, OfflineBanner } from './States';

describe('ErrorState (E4)', () => {
  afterEach(cleanup);

  it('muestra el código E-<status> y reintenta', () => {
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <ErrorState error={new ApiError('INTERNAL', 503, 'x')} onRetry={onRetry} />
      </MemoryRouter>,
    );
    expect(screen.getByText('E-503')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('explica la falta de conexión', () => {
    render(
      <MemoryRouter>
        <ErrorState error={new ApiError('NETWORK', null, 'x')} onRetry={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No hay conexión/)).toBeTruthy();
    expect(screen.getByText('E-RED')).toBeTruthy();
  });
});

describe('OfflineBanner (E3)', () => {
  afterEach(cleanup);

  it('dice hace cuánto se guardaron los precios', () => {
    render(<OfflineBanner savedAt={Date.now() - 2 * 3_600_000} />);
    expect(screen.getByRole('status').textContent).toMatch(/guardados hace 2 h/);
  });
});
