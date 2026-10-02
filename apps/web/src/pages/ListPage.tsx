import type { ReportSort } from '@indice/shared';
import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { EmptyNearby } from '../components/EmptyNearby';
import { LoadPriceButton } from '../components/LoadPriceButton';
import { LocationChip } from '../components/LocationChip';
import { ReportRow, ReportRowSkeleton } from '../components/ReportRow';
import { ErrorState, OfflineBanner } from '../components/States';
import { ViewToggle } from '../components/ViewToggle';
import { useUserLocation } from '../lib/location-context';
import { useOnline } from '../lib/online';
import { useReports } from '../lib/queries';
import { readJson, writeJson } from '../lib/storage';

const SORTS: Array<{ value: ReportSort; label: string }> = [
  { value: 'price', label: 'Más barato' },
  { value: 'distance', label: 'Más cerca' },
  { value: 'recent', label: 'Más reciente' },
];

const SORT_KEY = 'sort.v1';

function initialSort(): ReportSort {
  const saved = readJson<ReportSort>(SORT_KEY);
  return SORTS.some((s) => s.value === saved) ? saved! : 'price';
}

export function ListPage() {
  const { location } = useUserLocation();
  const online = useOnline();
  const [sort, setSort] = useState<ReportSort>(initialSort);
  const reports = useReports(location, sort);

  if (!location) return <Navigate to="/ubicacion" replace />;
  if (location.kind !== 'point') return <Navigate to="/" replace />;

  const pages = reports.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  const total = pages[0]?.total ?? 0;

  const chooseSort = (value: ReportSort) => {
    setSort(value);
    writeJson(SORT_KEY, value);
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-3.5 pt-4 pb-28">
      <div className="flex items-center gap-2 px-4">
        <LocationChip location={location} withRadius className="flex-1 rounded-2xl" />
        <ViewToggle />
      </div>

      {!online && (
        <div className="px-4">
          <OfflineBanner savedAt={reports.dataUpdatedAt || null} />
        </div>
      )}

      <div role="group" aria-label="Ordenar" className="flex gap-2 overflow-x-auto px-4">
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={sort === s.value}
            onClick={() => chooseSort(s.value)}
            className={`min-h-10 shrink-0 cursor-pointer rounded-full border px-3.5 text-sm ${
              sort === s.value
                ? 'border-ink bg-ink font-semibold text-white'
                : 'border-line-strong bg-white text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {reports.isPending && reports.fetchStatus !== 'idle' ? (
        <ul className="m-0 flex list-none flex-col gap-2.5 px-4" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <ReportRowSkeleton key={i} />
          ))}
        </ul>
      ) : reports.isError && !reports.data ? (
        <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />
      ) : total === 0 && reports.data ? (
        <EmptyNearby location={location} online={online} />
      ) : (
        <>
          <p className="m-0 px-4 text-[13px] text-muted" aria-live="polite">
            {total === 1
              ? '1 oferta de los últimos 7 días'
              : `${total} ofertas de los últimos 7 días`}
          </p>
          <ul className="m-0 flex list-none flex-col gap-2.5 px-4">
            {items.map((report, i) => (
              <ReportRow
                key={report.id}
                report={report}
                highlight={sort === 'price' && i === 0}
                showQuality
              />
            ))}
          </ul>
          {reports.hasNextPage && (
            <button
              type="button"
              onClick={() => void reports.fetchNextPage()}
              disabled={reports.isFetchingNextPage || !online}
              className="mx-4 min-h-12 cursor-pointer rounded-2xl border border-line-strong bg-white font-semibold text-ink disabled:opacity-50"
            >
              {reports.isFetchingNextPage ? 'Cargando…' : 'Ver más ofertas'}
            </button>
          )}
          {reports.isFetchNextPageError && (
            <p role="alert" className="m-0 px-4 text-sm text-danger">
              No pudimos cargar más ofertas. Probá de nuevo.
            </p>
          )}
        </>
      )}

      <Link
        to="/"
        className="flex min-h-11 items-center justify-center text-sm font-semibold no-underline"
      >
        Volver al inicio
      </Link>
      {!(total === 0 && !!reports.data && online) && <LoadPriceButton online={online} />}
    </main>
  );
}
