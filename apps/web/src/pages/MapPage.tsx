import type { ReportItemDto } from '@indice/shared';
import { useState } from 'react';
import { Navigate } from 'react-router';
import { LoadPriceButton } from '../components/LoadPriceButton';
import { LocationChip } from '../components/LocationChip';
import { OfferSheet } from '../components/OfferSheet';
import { LazyPriceMap } from '../components/LazyPriceMap';
import { ErrorState, OfflineBanner } from '../components/States';
import { ViewToggle } from '../components/ViewToggle';
import { useUserLocation } from '../lib/location-context';
import { useOnline } from '../lib/online';
import { useMapReports } from '../lib/queries';

export function MapPage() {
  const { location } = useUserLocation();
  const online = useOnline();
  const reports = useMapReports(location);
  const [selected, setSelected] = useState<ReportItemDto | null>(null);

  if (!location) return <Navigate to="/ubicacion" replace />;
  if (location.kind !== 'point') return <Navigate to="/" replace />;

  const items = reports.data?.items ?? [];
  const failed = reports.isError && !reports.data;

  return (
    <main className="relative h-dvh overflow-hidden bg-[#E7EAE2]">
      <h1 className="sr-only">Mapa de precios</h1>
      <LazyPriceMap
        location={location}
        reports={items}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
        className="absolute inset-0"
      />
      <div className="absolute inset-x-4 top-4 z-[1000] mx-auto flex max-w-xl flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <LocationChip
            location={location}
            withRadius
            className="flex-1 rounded-2xl border-0 shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
          />
          <ViewToggle className="border-0 shadow-[0_2px_8px_rgba(0,0,0,0.12)]" />
        </div>
        {!online && <OfflineBanner savedAt={reports.dataUpdatedAt || null} />}
        {reports.data && reports.data.total === 0 && (
          <div
            role="status"
            className="rounded-2xl bg-white px-4 py-3 text-sm shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
          >
            No hay precios cargados en esta zona en los últimos 7 días.
          </div>
        )}
      </div>

      {failed && (
        <div className="absolute inset-x-4 top-1/2 z-[1000] mx-auto max-w-md -translate-y-1/2 rounded-3xl bg-white shadow-lg">
          <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />
        </div>
      )}

      {selected ? (
        <div className="absolute inset-x-0 bottom-0 z-[1000] mx-auto max-w-xl">
          <OfferSheet key={selected.id} report={selected} onClose={() => setSelected(null)} />
        </div>
      ) : (
        <LoadPriceButton online={online} />
      )}
    </main>
  );
}
