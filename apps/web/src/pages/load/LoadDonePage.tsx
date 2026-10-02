import { Link, Navigate, useLocation } from 'react-router';
import { formatArs } from '../../lib/format';
import type { DoneState } from './LoadConfirmPage';

export function LoadDonePage() {
  const state = useLocation().state as DoneState | null;
  if (!state) return <Navigate to="/" replace />;
  const { response, storeName, line, quality } = state;
  const comparison = response.comparison;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-leaf-soft text-leaf">
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12l5 5 9-10" />
        </svg>
      </div>
      <div role="status">
        <h1 className="m-0 font-display text-[26px] leading-tight font-extrabold tracking-tight">
          ¡Listo, tu precio ya está publicado!
        </h1>
      </div>
      <p className="m-0 text-[15px] leading-relaxed text-muted">
        {quality === 'primera'
          ? `Ya cuenta para el índice de ${response.zone.name}.`
          : 'Ya aparece en el mapa. Las ofertas de segunda no entran en el índice.'}
      </p>
      <div className="flex items-start justify-between gap-3 self-stretch rounded-2xl border border-line bg-white p-4 text-left">
        <div>
          <div className="text-[15px] font-semibold">{storeName}</div>
          <div className="text-[13px] text-muted">
            {line} · {quality === 'primera' ? 'Primera' : 'Segunda'}
          </div>
        </div>
        <div className="font-display text-[22px] font-extrabold whitespace-nowrap text-leaf">
          {formatArs(response.report.pricePerKg)}/kg
        </div>
      </div>
      {comparison && (
        <p className="m-0 text-sm text-muted">
          {comparison.diffPct === 0
            ? `Igual a la mediana de ${response.zone.name}`
            : `${Math.abs(comparison.diffPct)}% ${comparison.diffPct < 0 ? 'por debajo' : 'por encima'} de la mediana de ${response.zone.name} (${formatArs(comparison.zoneMedian)})`}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 self-stretch">
        <Link
          to="/mapa"
          className="flex h-14 items-center justify-center rounded-2xl bg-brand font-semibold text-white no-underline hover:text-white"
        >
          Ver en el mapa
        </Link>
        <Link
          to="/cargar"
          className="flex h-12 items-center justify-center font-semibold no-underline"
        >
          Cargar otro precio
        </Link>
      </div>
    </main>
  );
}
