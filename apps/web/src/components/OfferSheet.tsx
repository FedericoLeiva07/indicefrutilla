import type {
  FlagReason,
  ReportItemDto,
  ReportUnavailableDetails,
  ReportVotesDto,
  VoteValue,
} from '@indice/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { type ApiError, toApiError } from '../lib/api';
import { flagReport, useReportDetail, voteReport } from '../lib/community-api';
import { formatArs, formatDistance, offerLine, relativeObserved } from '../lib/format';
import { useOnline } from '../lib/online';

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

const FLAG_REASONS: Array<{ value: FlagReason; label: string }> = [
  { value: 'precio_falso', label: 'El precio es falso o está mal' },
  { value: 'duplicada', label: 'Está duplicada' },
  { value: 'spam', label: 'Es spam o publicidad' },
];

const UNAVAILABLE_TEXT: Record<ReportUnavailableDetails['reason'], string> = {
  expired: 'Venció: tiene más de 7 días',
  downvoted: 'La comunidad marcó que ya no está',
  flagged: 'La ocultó la comunidad por denuncias',
};

type View =
  | { kind: 'offer' }
  | { kind: 'flag' }
  | { kind: 'unavailable'; reason: ReportUnavailableDetails['reason'] };

export function OfferSheet({
  report: initial,
  onClose,
}: {
  report: ReportItemDto;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const online = useOnline();
  const detail = useReportDetail(initial.id);
  const report = detail.data ? { ...detail.data, distanceM: initial.distanceM } : initial;
  const detailError = detail.error ? toApiError(detail.error) : null;

  const [votes, setVotes] = useState<ReportVotesDto | null>(null);
  const [myVote, setMyVote] = useState<VoteValue | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: 'offer' });
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<FlagReason>('precio_falso');
  const [flagged, setFlagged] = useState(false);

  const shownVotes = votes ?? report.votes;
  const shownMyVote = myVote ?? report.myVote;
  const unavailable =
    view.kind === 'unavailable'
      ? view.reason
      : detailError?.code === 'REPORT_UNAVAILABLE'
        ? (detailError.details as ReportUnavailableDetails).reason
        : null;

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: ['reports'] });
    void queryClient.invalidateQueries({ queryKey: ['summary'] });
  };

  const goneOnOpen = detailError?.code === 'REPORT_UNAVAILABLE';
  useEffect(() => {
    if (goneOnOpen) void queryClient.invalidateQueries({ queryKey: ['reports'] });
  }, [goneOnOpen, queryClient]);

  const handleUnavailable = (err: ApiError) => {
    if (err.code !== 'REPORT_UNAVAILABLE') return false;
    setView({ kind: 'unavailable', reason: (err.details as ReportUnavailableDetails).reason });
    refreshLists();
    return true;
  };

  const vote = async (value: VoteValue) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await voteReport(report.id, value);
      setVotes(res.votes);
      setMyVote(res.myVote);
      setMessage(
        value === 1
          ? 'Gracias, confirmaste que el precio sigue'
          : 'Gracias, marcaste que ya no está',
      );
      if (!res.active) refreshLists();
      else void queryClient.invalidateQueries({ queryKey: ['reports'] });
    } catch (err) {
      const apiError = toApiError(err);
      if (handleUnavailable(apiError)) return;
      if (apiError.code === 'ALREADY_VOTED') {
        const details = apiError.details as { votes: ReportVotesDto; myVote: VoteValue | null };
        setVotes(details.votes);
        setMyVote(details.myVote ?? value);
        return;
      }
      setMessage(`No pudimos registrar tu voto (${apiError.displayCode}). Probá de nuevo.`);
    } finally {
      setBusy(false);
    }
  };

  const sendFlag = async () => {
    setBusy(true);
    try {
      const res = await flagReport(report.id, reason);
      setFlagged(true);
      setView({ kind: 'offer' });
      if (res.hidden) {
        setView({ kind: 'unavailable', reason: 'flagged' });
        refreshLists();
      } else {
        setMessage('Gracias. Con 3 denuncias de dispositivos distintos, la ocultamos.');
      }
    } catch (err) {
      const apiError = toApiError(err);
      if (handleUnavailable(apiError)) return;
      setView({ kind: 'offer' });
      if (apiError.code === 'ALREADY_FLAGGED') {
        setFlagged(true);
        setMessage('Ya denunciaste esta oferta desde este dispositivo.');
      } else {
        setMessage(`No pudimos enviar la denuncia (${apiError.displayCode}). Probá de nuevo.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const shell =
    'flex flex-col gap-3 rounded-t-3xl bg-white px-5 pt-2.5 pb-7 shadow-[0_-4px_20px_rgba(0,0,0,0.12)]';
  const handle = (
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
  );

  if (unavailable) {
    return (
      <section aria-label="Oferta no disponible" className={shell}>
        {handle}
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-offline text-muted">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l3 2" />
            </svg>
          </span>
          <div>
            <h2 className="m-0 text-lg font-semibold">Esta oferta ya no está disponible</h2>
            <div className="text-[13px] text-muted">{UNAVAILABLE_TEXT[unavailable]}</div>
          </div>
        </div>
        <p className="m-0 text-sm leading-relaxed text-muted">
          Pasa cuando un precio tiene más de 7 días, muchos "ya no está" o varias denuncias. El mapa
          ya se actualizó.
        </p>
        <Link
          to="/ofertas"
          onClick={onClose}
          className="flex h-14 items-center justify-center rounded-2xl bg-brand font-semibold text-white no-underline hover:text-white"
        >
          Ver otras ofertas cerca
        </Link>
      </section>
    );
  }

  if (view.kind === 'flag') {
    return (
      <section role="dialog" aria-modal="true" aria-labelledby="flag-title" className={shell}>
        {handle}
        <h2 id="flag-title" className="m-0 text-[19px] font-semibold">
          ¿Qué pasa con esta oferta?
        </h2>
        <p className="m-0 text-sm text-muted">
          {report.store.name} · {formatArs(report.pricePerKg)}/kg. Con 3 denuncias de dispositivos
          distintos, la ocultamos.
        </p>
        <div role="radiogroup" aria-labelledby="flag-title" className="flex flex-col gap-2">
          {FLAG_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={reason === r.value}
              onClick={() => setReason(r.value)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3.5 text-left text-[15px] text-ink ${
                reason === r.value ? 'border-2 border-brand' : 'border border-line'
              }`}
            >
              <span
                className={`size-5 shrink-0 rounded-full ${reason === r.value ? 'border-[6px] border-brand' : 'border-2 border-[#9AA39C]'}`}
                aria-hidden="true"
              />
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void sendFlag()}
          disabled={busy}
          className="h-14 cursor-pointer rounded-2xl border-0 bg-brand font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Enviando…' : 'Enviar denuncia'}
        </button>
        <button
          type="button"
          onClick={() => setView({ kind: 'offer' })}
          className="min-h-11 cursor-pointer self-center border-0 bg-transparent text-[15px] font-semibold text-ink"
        >
          Cancelar
        </button>
      </section>
    );
  }

  const place = [
    report.store.address,
    report.distanceM === null ? null : formatDistance(report.distanceM),
  ]
    .filter(Boolean)
    .join(' · ');
  const voted = shownMyVote !== null;

  return (
    <section aria-label={`Oferta de ${report.store.name}`} className={shell}>
      {handle}
      {message && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-[14px] bg-ink px-4 py-3 text-sm font-medium text-white"
        >
          {message}
        </div>
      )}
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
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={shownMyVote === 1}
          disabled={voted || busy || !online}
          onClick={() => void vote(1)}
          className={`flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-sm font-semibold disabled:cursor-default ${
            shownMyVote === 1
              ? 'border-2 border-leaf bg-leaf-soft text-leaf'
              : voted
                ? 'border border-line bg-ground text-[#9AA39C]'
                : 'border border-leaf bg-leaf text-white'
          }`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Sigue ({shownVotes.up})
        </button>
        <button
          type="button"
          aria-pressed={shownMyVote === -1}
          disabled={voted || busy || !online}
          onClick={() => void vote(-1)}
          className={`min-h-12 cursor-pointer rounded-xl text-sm font-semibold disabled:cursor-default ${
            shownMyVote === -1
              ? 'border-2 border-ink bg-ground text-ink'
              : voted
                ? 'border border-line bg-ground text-[#9AA39C]'
                : 'border border-line-strong bg-white text-ink'
          }`}
        >
          Ya no está{shownVotes.down > 0 ? ` (${shownVotes.down})` : ''}
        </button>
      </div>
      {voted && (
        <div className="text-center text-[13px] text-muted">
          Ya votaste esta oferta desde este dispositivo
        </div>
      )}
      <div className="flex items-center justify-center gap-4">
        <a
          href={directionsUrl(report.store.location.lat, report.store.location.lng)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center text-sm font-semibold no-underline"
        >
          Cómo llegar
        </a>
        {!flagged && online && (
          <button
            type="button"
            onClick={() => setView({ kind: 'flag' })}
            className="min-h-11 cursor-pointer border-0 bg-transparent text-sm font-semibold text-muted underline"
          >
            Denunciar esta oferta
          </button>
        )}
      </div>
    </section>
  );
}
