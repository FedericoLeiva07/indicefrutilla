import type { ReportItemDto } from '@indice/shared';
import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { EmptyNearby } from '../components/EmptyNearby';
import { GlobeIcon } from '../components/Icons';
import { IndexCard, IndexCardSkeleton } from '../components/IndexCard';
import { LoadPriceButton } from '../components/LoadPriceButton';
import { LocationChip } from '../components/LocationChip';
import { Logo } from '../components/Logo';
import { OfferSheet } from '../components/OfferSheet';
import { LazyPriceMap } from '../components/LazyPriceMap';
import { ReportRow, ReportRowSkeleton } from '../components/ReportRow';
import { ErrorState, OfflineBanner } from '../components/States';
import { useUserLocation } from '../lib/location-context';
import { useOnline } from '../lib/online';
import { useIndexSummary, useMapReports, useReports } from '../lib/queries';

const PREVIEW_COUNT = 3;

export function HomePage() {
  const { location } = useUserLocation();
  const online = useOnline();
  const summary = useIndexSummary(location);
  const reports = useReports(location, 'price');
  const mapReports = useMapReports(location);
  const [selected, setSelected] = useState<ReportItemDto | null>(null);

  if (!location) return <Navigate to="/ubicacion" replace />;

  const savedAt = Math.max(summary.dataUpdatedAt, reports.dataUpdatedAt) || null;
  const firstPage = reports.data?.pages[0];
  const preview = firstPage?.items.slice(0, PREVIEW_COUNT) ?? [];
  const isPoint = location.kind === 'point';

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 pb-28 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-8 lg:px-8">
      <div className="flex flex-col gap-4">
        <header className="flex items-center justify-between gap-3 px-5 pt-5 lg:px-0">
          <Logo />
          <LocationChip location={location} className="max-w-[60%]" />
        </header>

        {!online && (
          <div className="px-5 lg:px-0">
            <OfflineBanner savedAt={savedAt} />
          </div>
        )}

        <div className="px-5 lg:px-0">
          {summary.isPending && summary.fetchStatus !== 'idle' ? (
            <IndexCardSkeleton />
          ) : summary.isError && !summary.data ? (
            <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
          ) : summary.data ? (
            <IndexCard summary={summary.data} />
          ) : null}
          <Link
            to="/indice"
            className="mt-2 flex min-h-11 items-center justify-end text-sm font-semibold no-underline"
          >
            Ver el índice de todo el país
          </Link>
        </div>

        {isPoint ? (
          <>
            <div className="flex items-center justify-between px-5 lg:px-0">
              <h2 className="m-0 font-display text-[19px] font-semibold">Cerca tuyo</h2>
              <div className="flex gap-1">
                <Link
                  to="/mapa"
                  className="flex min-h-11 items-center px-2.5 text-sm font-semibold no-underline lg:hidden"
                >
                  Ver mapa
                </Link>
                <Link
                  to="/ofertas"
                  className="flex min-h-11 items-center px-2.5 text-sm font-semibold no-underline"
                >
                  Ver todas
                </Link>
              </div>
            </div>
            <div className="px-5 lg:px-0">
              {reports.isPending && reports.fetchStatus !== 'idle' ? (
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0" aria-busy="true">
                  <ReportRowSkeleton />
                  <ReportRowSkeleton />
                  <ReportRowSkeleton />
                </ul>
              ) : reports.isError && !reports.data ? (
                <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />
              ) : firstPage && firstPage.total === 0 ? (
                <EmptyNearby location={location} online={online} />
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {preview.map((report, i) => (
                    <ReportRow key={report.id} report={report} highlight={i === 0} />
                  ))}
                </ul>
              )}
              {(summary.isPending || reports.isPending) && online && (
                <p className="mt-3 text-center text-[13px] text-muted">
                  Buscando precios cerca tuyo…
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="mx-5 flex items-start gap-3 rounded-2xl border border-line bg-white p-4 lg:mx-0">
            <GlobeIcon className="mt-0.5 shrink-0 text-muted" />
            <p className="m-0 text-sm leading-relaxed text-muted">
              Estás viendo el índice de todo el país.{' '}
              <Link to="/ubicacion" className="font-semibold">
                Elegí una zona
              </Link>{' '}
              para ver las ofertas cercanas.
            </p>
          </div>
        )}
      </div>

      {isPoint && (
        <aside className="relative hidden lg:sticky lg:top-6 lg:mt-5 lg:block lg:h-[calc(100vh-48px)]">
          <LazyPriceMap
            location={location}
            reports={mapReports.data?.items ?? []}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            className="h-full w-full overflow-hidden rounded-3xl border border-line"
          />
          {selected && (
            <div className="absolute inset-x-3 bottom-3 z-[1000]">
              <OfferSheet key={selected.id} report={selected} onClose={() => setSelected(null)} />
            </div>
          )}
        </aside>
      )}

      {!(firstPage?.total === 0 && online) && <LoadPriceButton online={online} />}
    </main>
  );
}
