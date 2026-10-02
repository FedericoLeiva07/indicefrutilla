import type { ReportItemDto } from '@indice/shared';
import { formatArs, formatDistance, offerLine, relativeObserved } from '../lib/format';

export function ReportRow({
  report,
  highlight = false,
  showQuality = false,
  onSelect,
}: {
  report: ReportItemDto;
  highlight?: boolean;
  showQuality?: boolean;
  onSelect?: (report: ReportItemDto) => void;
}) {
  const details = [
    offerLine(report.presentation, report.quantityG, report.priceArs),
    showQuality ? (report.quality === 'primera' ? 'Primera' : 'Segunda') : null,
    relativeObserved(report.observedAt, report.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');

  const body = (
    <>
      <div className="min-w-[78px]">
        <div className={`font-display text-xl font-extrabold ${highlight ? 'text-brand' : ''}`}>
          {formatArs(report.pricePerKg)}
        </div>
        <div className="text-xs text-muted">por kg</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{report.store.name}</div>
        <div className="text-[13px] text-muted">{details}</div>
      </div>
      {report.distanceM !== null && (
        <div className="text-[13px] whitespace-nowrap text-muted">
          {formatDistance(report.distanceM)}
        </div>
      )}
    </>
  );

  const className =
    'flex w-full items-center gap-3.5 rounded-2xl border border-line bg-white px-4 py-3.5 text-left text-ink';

  if (!onSelect) return <li className={className}>{body}</li>;
  return (
    <li>
      <button
        type="button"
        className={`${className} cursor-pointer`}
        onClick={() => onSelect(report)}
      >
        {body}
      </button>
    </li>
  );
}

export function ReportRowSkeleton() {
  return (
    <li className="flex items-center gap-3.5 rounded-2xl border border-line bg-white px-4 py-3.5">
      <div className="h-8.5 w-[70px] rounded-lg bg-skeleton" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-3 w-3/4 rounded-lg bg-skeleton" />
        <div className="h-2.5 w-1/2 rounded-lg bg-skeleton" />
      </div>
    </li>
  );
}
