import type { CreateReportResponse, PriceOutOfRangeDetails } from '@indice/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { AlertIcon, WifiOffIcon } from '../../components/Icons';
import { LoadGuard } from '../../components/LoadGuard';
import { LoadLayout, PrimaryButton } from '../../components/LoadLayout';
import { toApiError } from '../../lib/api';
import {
  type Draft,
  draftPricePerKg,
  draftQuantityG,
  loadName,
  observedAt,
  parseDecimal,
  saveName,
  serverFieldErrors,
} from '../../lib/draft';
import { useDraft } from '../../lib/draft-context';
import { formatArs, offerLine } from '../../lib/format';
import { createReport } from '../../lib/load-api';
import type { PointLocation } from '../../lib/location';
import { useIndexSummary } from '../../lib/queries';
import { TurnstileUnavailableError } from '../../lib/turnstile';
import { comparisonText, type PriceStepState } from './LoadPricePage';

type Failure =
  | { kind: 'rate'; seconds: number }
  | { kind: 'daily' }
  | { kind: 'turnstile' }
  | { kind: 'network' }
  | { kind: 'server'; code: string };

export interface DoneState {
  response: CreateReportResponse;
  storeName: string;
  line: string;
  quality: Draft['quality'];
}

const DAY_TEXT = ['hoy', 'ayer', 'anteayer'];

export function LoadConfirmPage() {
  return <LoadGuard>{(location) => <ConfirmStep location={location} />}</LoadGuard>;
}

function ConfirmStep({ location }: { location: PointLocation }) {
  const { draft, finish } = useDraft();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const nameId = useId();
  const summary = useIndexSummary(location);
  const [anonymous, setAnonymous] = useState(() => loadName() === '');
  const [name, setName] = useState(loadName);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [published, setPublished] = useState(false);

  const quantityG = draftQuantityG(draft);
  const price = parseDecimal(draft.priceText);
  const ppk = draftPricePerKg(draft);
  if (published) return null;
  if (!draft.store) return <Navigate to="/cargar" replace />;
  if (!draft.presentation || quantityG === null || price === null || ppk === null) {
    return <Navigate to="/cargar/precio" replace />;
  }

  const store = draft.store;
  const presentation = draft.presentation;
  const line = offerLine(presentation, quantityG, price);
  const qualityLabel = draft.quality === 'primera' ? 'Primera' : 'Segunda';
  const zone = summary.data?.levels[0];
  const median = zone?.published ? zone.medianPpk : null;

  const publish = async () => {
    setBusy(true);
    setFailure(null);
    const reporterName = anonymous ? undefined : name.trim().slice(0, 30) || undefined;
    if (!anonymous) saveName(name.trim());
    try {
      const response = await createReport(
        {
          storeId: store.id,
          priceArs: price,
          presentation,
          ...((presentation === 'cajon' || presentation === 'otro') && { quantityG }),
          quality: draft.quality,
          observedAt: observedAt(draft.daysAgo),
          ...(reporterName && { reporterName }),
        },
        draft.idempotencyKey,
      );
      setPublished(true);
      finish();
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      void queryClient.invalidateQueries({ queryKey: ['summary'] });
      void queryClient.invalidateQueries({ queryKey: ['stores'] });
      const done: DoneState = { response, storeName: store.name, line, quality: draft.quality };
      navigate('/cargar/listo', { replace: true, state: done });
    } catch (err) {
      if (err instanceof TurnstileUnavailableError) {
        setFailure({ kind: 'turnstile' });
        return;
      }
      const apiError = toApiError(err);
      switch (apiError.code) {
        case 'PRICE_OUT_OF_RANGE': {
          const state: PriceStepState = { outOfRange: apiError.details as PriceOutOfRangeDetails };
          navigate('/cargar/precio', { state });
          return;
        }
        case 'VALIDATION_FAILED': {
          const state: PriceStepState = { serverErrors: serverFieldErrors(apiError.details) };
          navigate('/cargar/precio', { state });
          return;
        }
        case 'STORE_NOT_FOUND':
          navigate('/cargar');
          return;
        case 'RATE_LIMITED':
          setFailure({ kind: 'rate', seconds: apiError.retryAfterSeconds ?? 60 });
          return;
        case 'DAILY_LIMIT_REACHED':
          setFailure({ kind: 'daily' });
          return;
        case 'TURNSTILE_FAILED':
          setFailure({ kind: 'turnstile' });
          return;
        case 'NETWORK':
          setFailure({ kind: 'network' });
          return;
        default:
          setFailure({ kind: 'server', code: apiError.displayCode });
      }
    } finally {
      setBusy(false);
    }
  };

  if (failure?.kind === 'rate') {
    return <RateLimited seconds={failure.seconds} onRetry={() => void publish()} />;
  }
  if (failure?.kind === 'daily') {
    return (
      <Outcome title="Llegaste al máximo de hoy" tone="warn">
        <p className="m-0 text-[15px] leading-relaxed text-muted">
          Desde un mismo dispositivo se pueden cargar hasta 20 precios por día. Mañana podés seguir
          sumando.
        </p>
        <p className="m-0 text-sm font-semibold">Se renueva a las 00:00</p>
        <Link
          to="/"
          className="mt-3 flex h-14 items-center justify-center self-stretch rounded-2xl bg-brand font-semibold text-white no-underline hover:text-white"
        >
          Volver al inicio
        </Link>
      </Outcome>
    );
  }
  if (failure?.kind === 'turnstile') {
    return (
      <Outcome title="No pudimos verificar que sos una persona" tone="warn">
        <p className="m-0 text-[15px] leading-relaxed text-muted">
          Puede pasar con VPN, bloqueadores de contenido o una conexión inestable. Tus datos siguen
          cargados.
        </p>
        <div className="mt-3 flex flex-col gap-2 self-stretch">
          <PrimaryButton onClick={() => void publish()} busy={busy}>
            Intentar de nuevo
          </PrimaryButton>
          <button
            type="button"
            onClick={() => setFailure(null)}
            className="h-12 cursor-pointer border-0 bg-transparent font-semibold text-brand"
          >
            Volver al resumen
          </button>
        </div>
      </Outcome>
    );
  }
  if (failure?.kind === 'network' || failure?.kind === 'server') {
    return (
      <Outcome
        title="No se pudo publicar"
        tone="danger"
        icon={failure.kind === 'network' ? <WifiOffIcon size={28} /> : undefined}
      >
        <p className="m-0 text-[15px] leading-relaxed text-muted">
          {failure.kind === 'network'
            ? 'Se cortó la conexión. Guardamos tu carga en este dispositivo: reintentá cuando vuelva la señal.'
            : `Tuvimos un problema de nuestro lado (${failure.code}). Guardamos tu carga en este dispositivo: reintentá en unos segundos.`}
        </p>
        <Summary
          storeName={store.name}
          line={`${line} · ${qualityLabel} · ${DAY_TEXT[draft.daysAgo]}`}
          ppk={ppk}
        />
        <p className="m-0 text-sm text-muted">
          {anonymous || !name.trim() ? 'Aparecés como anónimo' : `Aparecés como ${name.trim()}`}
        </p>
        <div className="mt-2 flex flex-col gap-2 self-stretch">
          <PrimaryButton onClick={() => void publish()} busy={busy}>
            Reintentar publicar
          </PrimaryButton>
          <Link to="/" className="flex h-12 items-center justify-center font-semibold no-underline">
            Volver al inicio
          </Link>
        </div>
      </Outcome>
    );
  }

  return (
    <LoadLayout
      step={3}
      title="Revisá y publicá"
      back="/cargar/precio"
      footer={
        <PrimaryButton onClick={() => void publish()} busy={busy}>
          {busy ? 'Publicando…' : 'Publicar precio'}
        </PrimaryButton>
      }
    >
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
        <Summary
          storeName={store.name}
          line={`${line} · ${qualityLabel} · ${DAY_TEXT[draft.daysAgo]}`}
          ppk={ppk}
          bare
        />
        {median !== null && zone && (
          <div className="rounded-[10px] bg-leaf-soft px-2.5 py-2 text-[13px] text-leaf">
            {comparisonText(ppk, median, zone.name)}
          </div>
        )}
      </section>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" disabled={busy}>
        <legend className="mb-2.5 p-0 text-base font-semibold">¿Cómo querés aparecer?</legend>
        <div role="radiogroup" className="flex flex-col gap-2">
          <div
            className={`flex flex-col gap-3 rounded-[14px] bg-white px-4 py-3.5 ${!anonymous ? 'border-2 border-brand' : 'border border-line'}`}
          >
            <RadioRow
              checked={!anonymous}
              title="Con un nombre"
              detail="Aparece junto a tu precio"
              onSelect={() => setAnonymous(false)}
            />
            {!anonymous && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={nameId} className="text-[13px] font-semibold">
                  Nombre o apodo
                </label>
                <input
                  id={nameId}
                  value={name}
                  maxLength={30}
                  autoComplete="nickname"
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl border border-line-strong bg-white px-3.5 text-base text-ink"
                />
                <span className="text-xs text-muted">
                  Se guarda solo en este dispositivo, para la próxima vez.
                </span>
              </div>
            )}
          </div>
          <div
            className={`rounded-[14px] bg-white px-4 py-3.5 ${anonymous ? 'border-2 border-brand' : 'border border-line'}`}
          >
            <RadioRow
              checked={anonymous}
              title="Anónimo"
              detail="Tu precio aparece sin nombre"
              onSelect={() => setAnonymous(true)}
            />
          </div>
        </div>
      </fieldset>
    </LoadLayout>
  );
}

function RadioRow({
  checked,
  title,
  detail,
  onSelect,
}: {
  checked: boolean;
  title: string;
  detail: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex min-h-11 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left text-ink"
    >
      <span
        className={`size-5 shrink-0 rounded-full ${checked ? 'border-[6px] border-brand' : 'border-2 border-[#9AA39C]'}`}
        aria-hidden="true"
      />
      <span>
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[13px] text-muted">{detail}</span>
      </span>
    </button>
  );
}

function Summary({
  storeName,
  line,
  ppk,
  bare = false,
}: {
  storeName: string;
  line: string;
  ppk: number;
  bare?: boolean;
}) {
  const body = (
    <div className="flex items-start justify-between gap-3 text-left">
      <div>
        <div className="text-[15px] font-semibold">{storeName}</div>
        <div className="text-[13px] text-muted">{line}</div>
      </div>
      <div className="text-right">
        <div className="font-display text-[22px] leading-none font-extrabold text-leaf">
          {formatArs(ppk)}
        </div>
        <div className="text-xs text-muted">por kg</div>
      </div>
    </div>
  );
  if (bare) return body;
  return <div className="self-stretch rounded-2xl border border-line bg-white p-4">{body}</div>;
}

function Outcome({
  title,
  tone,
  icon,
  children,
}: {
  title: string;
  tone: 'warn' | 'danger';
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      <div
        className={`flex size-16 items-center justify-center rounded-full ${
          tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-danger-soft text-danger'
        }`}
      >
        {icon ?? <AlertIcon size={28} />}
      </div>
      <h1 role="alert" className="m-0 font-display text-2xl font-extrabold tracking-tight">
        {title}
      </h1>
      {children}
    </main>
  );
}

function RateLimited({ seconds, onRetry }: { seconds: number; onRetry: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <Outcome title="Estás cargando muy rápido" tone="warn">
      <p className="m-0 text-[15px] leading-relaxed text-muted">
        Por seguridad limitamos los envíos seguidos desde una misma conexión. Tus datos quedaron
        guardados en este dispositivo.
      </p>
      <div className="mt-3 flex flex-col gap-1.5 self-stretch">
        <PrimaryButton onClick={onRetry} disabled={left > 0}>
          {left > 0 ? `Reintentar en ${mm}:${ss}` : 'Reintentar'}
        </PrimaryButton>
        <span className="text-[13px] text-muted">
          El botón se habilita solo cuando termina la espera
        </span>
        <Link to="/" className="flex h-12 items-center justify-center font-semibold no-underline">
          Volver al inicio
        </Link>
      </div>
    </Outcome>
  );
}
