import type { PriceOutOfRangeDetails, Presentation } from '@indice/shared';
import { useId, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { LoadGuard } from '../../components/LoadGuard';
import { LoadLayout, Notice, PrimaryButton } from '../../components/LoadLayout';
import {
  CAJON_KG_OPTIONS,
  DAYS_AGO_OPTIONS,
  type DraftError,
  type DraftField,
  draftPricePerKg,
  formatPriceInput,
  validateDraft,
} from '../../lib/draft';
import { useDraft } from '../../lib/draft-context';
import { formatArs } from '../../lib/format';
import { useReferenceLatest } from '../../lib/load-api';
import type { PointLocation } from '../../lib/location';
import { useIndexSummary } from '../../lib/queries';

const PRESENTATIONS: Array<{ value: Presentation; label: string }> = [
  { value: 'g250', label: '250 g' },
  { value: 'g500', label: '500 g' },
  { value: 'kg1', label: '1 kg' },
  { value: 'cajon', label: 'Cajón' },
  { value: 'otro', label: 'Otro' },
];

const DAY_LABELS = ['Hoy', 'Ayer', 'Anteayer'];

export interface PriceStepState {
  outOfRange?: PriceOutOfRangeDetails;
  serverErrors?: DraftError[];
}

export function LoadPricePage() {
  return <LoadGuard>{(location) => <PriceStep location={location} />}</LoadGuard>;
}

function chip(selected: boolean, invalid = false): string {
  if (selected) return 'border-2 border-brand bg-brand-soft font-semibold text-brand-dark';
  return `border bg-white text-ink ${invalid ? 'border-danger-line' : 'border-line-strong'}`;
}

function PriceStep({ location }: { location: PointLocation }) {
  const { draft, update } = useDraft();
  const navigate = useNavigate();
  const routeState = (useLocation().state ?? {}) as PriceStepState;
  const ids = { price: useId(), otherKg: useId(), otherGrams: useId() };
  const priceRef = useRef<HTMLInputElement>(null);
  const reference = useReferenceLatest();
  const summary = useIndexSummary(location);
  const [errors, setErrors] = useState<DraftError[]>(routeState.serverErrors ?? []);
  const [outOfRange, setOutOfRange] = useState<PriceOutOfRangeDetails | null>(
    routeState.outOfRange ?? null,
  );

  if (!draft.store) return <Navigate to="/cargar" replace />;

  const ppk = draftPricePerKg(draft);
  const zone = summary.data?.levels[0];
  const zoneMedian = zone?.published ? zone.medianPpk : null;
  const fieldError = (field: DraftField) => errors.find((e) => e.field === field);

  const edit = (patch: Parameters<typeof update>[0]) => {
    update(patch);
    if (errors.length > 0) setErrors([]);
    if (outOfRange) setOutOfRange(null);
  };

  const next = () => {
    const found = validateDraft(draft);
    setErrors(found);
    if (found.length > 0) return;
    const range = reference.data;
    if (range && ppk !== null && (ppk < range.plausibleMin || ppk > range.plausibleMax)) {
      setOutOfRange({
        plausibleMin: range.plausibleMin,
        plausibleMax: range.plausibleMax,
        pricePerKg: ppk,
      });
      return;
    }
    navigate('/cargar/confirmar');
  };

  const correct = () => {
    setOutOfRange(null);
    priceRef.current?.focus();
    priceRef.current?.select();
  };

  const tooHigh = outOfRange && outOfRange.pricePerKg > outOfRange.plausibleMax;
  const usualRange =
    zone?.published && zone.p25Ppk !== null && zone.p75Ppk !== null
      ? ` (${formatArs(zone.p25Ppk)} a ${formatArs(zone.p75Ppk)} por kg)`
      : '';

  return (
    <LoadLayout
      step={2}
      title="¿Cuánto estaban?"
      back="/cargar"
      footer={
        outOfRange ? (
          <PrimaryButton onClick={correct}>Corregir el precio</PrimaryButton>
        ) : (
          <PrimaryButton onClick={next}>Continuar</PrimaryButton>
        )
      }
    >
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{draft.store.name}</div>
          <div className="truncate text-[13px] text-muted">{draft.store.address}</div>
        </div>
        <Link
          to="/cargar"
          className="flex min-h-11 items-center px-2 text-sm font-semibold no-underline"
        >
          Cambiar
        </Link>
      </div>

      {errors.length > 0 && (
        <Notice tone="danger" role="alert">
          <strong>Revisá {errors.length === 1 ? '1 dato' : `${errors.length} datos`}</strong> antes
          de seguir.
        </Notice>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.price} className="text-sm font-semibold">
          Precio del cartel
        </label>
        <div
          className={`flex h-15 items-center gap-1.5 rounded-[14px] border-2 bg-white px-4 ${
            fieldError('priceArs')
              ? 'border-danger'
              : outOfRange
                ? 'border-warn-line'
                : 'border-ink'
          }`}
        >
          <span className="text-[22px] text-muted">$</span>
          <input
            id={ids.price}
            ref={priceRef}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={draft.priceText}
            onChange={(e) => edit({ priceText: formatPriceInput(e.target.value) })}
            aria-invalid={!!fieldError('priceArs')}
            aria-describedby={fieldError('priceArs') ? `${ids.price}-error` : undefined}
            className="min-w-0 flex-1 border-0 bg-transparent font-display text-[26px] font-extrabold text-ink outline-none"
          />
        </div>
        <FieldError id={`${ids.price}-error`} error={fieldError('priceArs')} />
      </div>

      <fieldset
        className="m-0 flex flex-col gap-2 border-0 p-0"
        aria-invalid={!!fieldError('presentation')}
      >
        <legend className="mb-2 p-0 text-sm font-semibold">Presentación</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {PRESENTATIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={draft.presentation === p.value}
              onClick={() => edit({ presentation: p.value })}
              className={`min-h-12 cursor-pointer rounded-xl px-1 text-sm ${chip(draft.presentation === p.value, !!fieldError('presentation'))}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <FieldError error={fieldError('presentation')} />

        {draft.presentation === 'cajon' && (
          <fieldset
            className="m-0 mt-1 flex flex-col gap-2 border-0 p-0"
            aria-invalid={!!fieldError('quantityG')}
          >
            <legend className="mb-2 p-0 text-sm font-semibold">
              ¿De cuántos kilos es el cajón?
            </legend>
            <div className="grid grid-cols-4 gap-1.5">
              {CAJON_KG_OPTIONS.map((kg) => (
                <button
                  key={kg}
                  type="button"
                  aria-pressed={draft.cajonKg === kg}
                  onClick={() => edit({ cajonKg: kg })}
                  className={`min-h-12 cursor-pointer rounded-xl text-sm ${chip(draft.cajonKg === kg, !!fieldError('quantityG'))}`}
                >
                  {kg} kg
                </button>
              ))}
              {draft.cajonKg === 'otro' ? (
                <input
                  id={ids.otherKg}
                  aria-label="Kilos del cajón"
                  inputMode="decimal"
                  placeholder="kg"
                  value={draft.cajonOtherKg}
                  autoFocus
                  onChange={(e) =>
                    edit({ cajonOtherKg: e.target.value.replace(/[^\d,]/g, '').slice(0, 5) })
                  }
                  className="min-h-12 min-w-0 rounded-xl border-2 border-brand bg-brand-soft px-2.5 text-center text-sm font-semibold text-brand-dark"
                />
              ) : (
                <button
                  type="button"
                  aria-pressed={false}
                  onClick={() => edit({ cajonKg: 'otro' })}
                  className={`min-h-12 cursor-pointer rounded-xl text-sm ${chip(false, !!fieldError('quantityG'))}`}
                >
                  Otro
                </button>
              )}
            </div>
            <FieldError error={fieldError('quantityG')} />
          </fieldset>
        )}

        {draft.presentation === 'otro' && (
          <div className="mt-1 flex flex-col gap-1.5">
            <label htmlFor={ids.otherGrams} className="text-sm font-semibold">
              ¿Cuántos gramos?
            </label>
            <input
              id={ids.otherGrams}
              inputMode="numeric"
              placeholder="Por ejemplo, 750"
              value={draft.otherGrams}
              onChange={(e) =>
                edit({ otherGrams: formatPriceInput(e.target.value.replace(',', '')) })
              }
              aria-invalid={!!fieldError('quantityG')}
              className={`h-12 rounded-xl bg-white px-3.5 text-base text-ink ${
                fieldError('quantityG') ? 'border-2 border-danger' : 'border border-line-strong'
              }`}
            />
            <FieldError error={fieldError('quantityG')} />
          </div>
        )}
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold">Calidad</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {(['primera', 'segunda'] as const).map((q) => (
            <button
              key={q}
              type="button"
              aria-pressed={draft.quality === q}
              onClick={() => edit({ quality: q })}
              className={`min-h-12 cursor-pointer rounded-xl text-sm ${chip(draft.quality === q)}`}
            >
              {q === 'primera' ? 'Primera' : 'Segunda'}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold">¿Cuándo lo viste?</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {DAYS_AGO_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={draft.daysAgo === d}
              onClick={() => edit({ daysAgo: d })}
              className={`min-h-12 cursor-pointer rounded-xl text-sm ${chip(draft.daysAgo === d)}`}
            >
              {DAY_LABELS[d]}
            </button>
          ))}
        </div>
      </fieldset>

      <div
        aria-live="polite"
        className={`flex items-center justify-between rounded-[14px] px-4 py-3.5 ${
          outOfRange ? 'bg-warn-soft text-warn' : 'bg-leaf-soft text-leaf'
        }`}
      >
        <span className="text-sm font-medium">Equivale a</span>
        <span className="font-display text-[22px] font-extrabold">
          {ppk === null ? 'Completá el peso' : `${formatArs(ppk)} /kg`}
        </span>
      </div>
      {ppk !== null && zoneMedian !== null && !outOfRange && zone && (
        <p className="m-0 text-[13px] text-muted">{comparisonText(ppk, zoneMedian, zone.name)}</p>
      )}

      {outOfRange && (
        <Notice tone="warn">
          <strong>Es mucho {tooHigh ? 'más' : 'menos'} que lo habitual en tu zona</strong>
          {usualRange}. ¿Lo escribiste bien? Revisá el precio y la presentación: con este valor no
          lo podemos publicar.
        </Notice>
      )}
    </LoadLayout>
  );
}

export function comparisonText(ppk: number, median: number, zone: string): string {
  const diff = Math.round(((ppk - median) / median) * 100);
  if (diff === 0) return `Igual a la mediana de ${zone} (${formatArs(median)})`;
  return `${Math.abs(diff)}% ${diff < 0 ? 'por debajo' : 'por encima'} de la mediana de ${zone} (${formatArs(median)})`;
}

function FieldError({ error, id }: { error?: DraftError; id?: string }) {
  if (!error) return null;
  return (
    <span id={id} className="text-[13px] font-medium text-danger">
      {error.message}
    </span>
  );
}
