import type { ReportItemDto } from '@indice/shared';
import { formatArs, formatDistance, offerLine, relativeObserved } from '../lib/format';

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function OfferSheet({ report, onClose }: { report: ReportItemDto; onClose: () => void }) {
  const place = [
    report.store.address,
    report.distanceM === null ? null : formatDistance(report.distanceM),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <section
      aria-label={`Oferta de ${report.store.name}`}
      className="flex flex-col gap-3 rounded-t-3xl bg-white px-5 pt-2.5 pb-7 shadow-[0_-4px_20px_rgba(0,0,0,0.12)]"
    >
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar la ficha"
          className="flex h-6 w-16 cursor-pointer items-center justify-center border-0 bg-transparent"
        >
          <span className="h-1 w-10 rounded-sm bg-line-strong" />
        </button>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="m-0 text-lg font-semibold">{report.store.name}</h2>
          <div className="text-[13px] text-muted">{place}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-[28px] leading-none font-extrabold text-brand">
            {formatArs(report.pricePerKg)}
          </div>
          <div className="text-xs text-muted">por kg</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-ground px-2.5 py-1 text-[13px]">
          {offerLine(report.presentation, report.quantityG, report.priceArs)}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${
            report.quality === 'primera' ? 'bg-leaf-soft text-leaf' : 'bg-ground text-ink'
          }`}
        >
          {report.quality === 'primera' ? 'Primera' : 'Segunda'}
        </span>
        <span className="rounded-full bg-ground px-2.5 py-1 text-[13px]">
          {relativeObserved(report.observedAt, report.createdAt)}
        </span>
        {report.reporterName && (
          <span className="rounded-full bg-ground px-2.5 py-1 text-[13px]">
            Lo cargó {report.reporterName}
          </span>
        )}
      </div>
      <a
        href={directionsUrl(report.store.location.lat, report.store.location.lng)}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-11 items-center justify-center self-center text-sm font-semibold no-underline"
      >
        Cómo llegar
      </a>
    </section>
  );
}
