import { INDEX_PUBLISH_THRESHOLD, type IndexLevelDto, type IndexSummaryDto } from '@indice/shared';
import { formatArs, weekLabel } from '../lib/format';

export function IndexCard({ summary }: { summary: IndexSummaryDto }) {
  const requested = summary.levels[0];
  if (!requested) return null;
  if (requested.published) return <PublishedCard summary={summary} level={requested} />;
  return <InsufficientCard summary={summary} level={requested} />;
}

function PublishedCard({ summary, level }: { summary: IndexSummaryDto; level: IndexLevelDto }) {
  return (
    <section
      aria-label={`Índice de ${level.name}`}
      className="flex flex-col gap-1 rounded-[20px] border border-line bg-white p-5"
    >
      <div className="text-[13px] text-muted">
        Mediana por kg · {weekLabel(summary.weekStart)} · {level.name}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[52px] leading-[1.05] font-extrabold tracking-tight">
          {formatArs(level.medianPpk!)}
        </span>
        <span className="text-base text-muted">/kg</span>
      </div>
      <WeeklyChange pct={level.weeklyChangePct} />
      <HistoryBars history={summary.history} />
      <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-divider pt-3.5">
        <Stat
          label="Más barato 25%"
          value={level.p25Ppk === null ? '—' : formatArs(level.p25Ppk)}
        />
        <Stat label="Más caro 25%" value={level.p75Ppk === null ? '—' : formatArs(level.p75Ppk)} />
        <Stat label="Muestra" value={`${level.sampleSize} ofertas`} />
      </div>
    </section>
  );
}

function InsufficientCard({ summary, level }: { summary: IndexSummaryDto; level: IndexLevelDto }) {
  const fallback = summary.shown;
  const reference = summary.reference;
  return (
    <section
      aria-label={`Índice de ${level.name}`}
      className="flex flex-col gap-1.5 rounded-[20px] border border-line bg-white p-5"
    >
      <div className="text-[13px] text-muted">
        {level.name} · {weekLabel(summary.weekStart)}
      </div>
      <h2 className="m-0 font-display text-2xl leading-tight font-extrabold tracking-tight">
        Todavía no hay datos suficientes
      </h2>
      <p className="m-0 text-sm leading-relaxed text-muted">
        El índice se publica con al menos {INDEX_PUBLISH_THRESHOLD.reports} ofertas de{' '}
        {INDEX_PUBLISH_THRESHOLD.stores} comercios.{' '}
        {level.sampleSize === 0
          ? 'Esta semana todavía no hay ofertas.'
          : `Esta semana hay ${level.sampleSize}.`}
      </p>
      {fallback ? (
        <Meanwhile label={`Mientras tanto, ${fallback.name}`} value={fallback.medianPpk} />
      ) : reference.modalPpk !== null ? (
        <>
          <Meanwhile
            label="Mientras tanto, Mayorista · Mercado Central de Buenos Aires"
            value={reference.modalPpk}
          />
          <HistoryBars history={summary.history} />
          <p className="m-0 text-xs text-muted">Fuente: {reference.source}</p>
        </>
      ) : null}
    </section>
  );
}

function Meanwhile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-divider pt-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-[17px] font-semibold whitespace-nowrap">
        {value === null ? '—' : `${formatArs(value)} /kg`}
      </span>
    </div>
  );
}

function WeeklyChange({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <div className="text-[13px] text-muted">Sin comparación con la semana anterior</div>;
  }
  if (pct === 0)
    return (
      <div className="text-[13px] font-semibold text-muted">= igual que la semana anterior</div>
    );
  const down = pct < 0;
  return (
    <div className={`text-[13px] font-semibold ${down ? 'text-leaf' : 'text-brand-dark'}`}>
      {down ? '▼' : '▲'} {Math.abs(pct)}% contra la semana anterior
    </div>
  );
}

export function HistoryBars({ history }: { history: IndexSummaryDto['history'] }) {
  const values = history.map((h) => h.medianPpk).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values) * 0.8;
  const last = history.length - 1;
  return (
    <figure className="m-0 mt-3.5">
      <div
        className="flex h-14 items-end gap-1.5"
        role="img"
        aria-label={historyDescription(history)}
      >
        {history.map((point, i) => (
          <div
            key={point.weekStart}
            className={`flex-1 rounded ${point.medianPpk === null ? 'bg-divider' : i === last ? 'bg-brand' : 'bg-brand-tint'}`}
            style={{
              height:
                point.medianPpk === null
                  ? '8%'
                  : `${Math.max(12, ((point.medianPpk - min) / Math.max(1, max - min)) * 100)}%`,
            }}
          />
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-xs text-muted">
        <span>hace {history.length - 1} semanas</span>
        <span>esta semana</span>
      </figcaption>
    </figure>
  );
}

function historyDescription(history: IndexSummaryDto['history']): string {
  return `Mediana de las últimas ${history.length} semanas: ${history
    .map((h) => (h.medianPpk === null ? 'sin datos' : formatArs(h.medianPpk)))
    .join(', ')}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-[15px] font-semibold">{value}</div>
    </div>
  );
}

export function IndexCardSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Cargando el índice"
      className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-5"
    >
      <div className="h-3 w-[70%] rounded-lg bg-skeleton" />
      <div className="h-12 w-[55%] rounded-[10px] bg-skeleton" />
      <div className="h-3 w-[40%] rounded-lg bg-skeleton" />
      <div className="mt-2 h-14 w-full rounded-md bg-skeleton" />
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        <div className="h-7.5 rounded-lg bg-skeleton" />
        <div className="h-7.5 rounded-lg bg-skeleton" />
        <div className="h-7.5 rounded-lg bg-skeleton" />
      </div>
    </section>
  );
}
