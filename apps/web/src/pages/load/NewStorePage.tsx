import type { StoreCandidateDto, StoreDuplicateDetails } from '@indice/shared';
import { lazy, Suspense, useId, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { LoadGuard } from '../../components/LoadGuard';
import { LoadLayout, Notice, PrimaryButton } from '../../components/LoadLayout';
import { toApiError } from '../../lib/api';
import { useDraft } from '../../lib/draft-context';
import { formatDistance } from '../../lib/format';
import { createStore, roundStorePin } from '../../lib/load-api';
import type { PointLocation } from '../../lib/location';
import { TurnstileUnavailableError } from '../../lib/turnstile';

const PinPicker = lazy(() =>
  import('../../components/PinPicker').then((m) => ({ default: m.PinPicker })),
);

type FieldErrors = Partial<Record<'name' | 'address', string>>;

export function NewStorePage() {
  return <LoadGuard>{(location) => <NewStoreForm location={location} />}</LoadGuard>;
}

function NewStoreForm({ location }: { location: PointLocation }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { update } = useDraft();
  const ids = { name: useId(), address: useId() };
  const [name, setName] = useState(params.get('nombre') ?? '');
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState({ lat: location.lat, lng: location.lng });
  const [moved, setMoved] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [candidates, setCandidates] = useState<StoreCandidateDto[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const pickStore = (store: {
    id: number;
    name: string;
    address: string;
    location: { lat: number; lng: number };
  }) => {
    update({ store });
    navigate('/cargar/precio');
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = 'Escribí el nombre del comercio';
    if (address.trim().length < 3) next.address = 'Escribí la dirección o una referencia';
    return next;
  };

  const submit = async (confirmedDistinct: boolean) => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setFailure(null);
    try {
      const store = await createStore(
        {
          name: name.trim(),
          address: address.trim(),
          lat: roundStorePin(pin.lat),
          lng: roundStorePin(pin.lng),
          ...(confirmedDistinct && { confirmedDistinct: true }),
        },
        idempotencyKey,
      );
      pickStore(store);
    } catch (err) {
      if (err instanceof TurnstileUnavailableError) {
        setFailure('No pudimos verificar que sos una persona. Probá de nuevo.');
        return;
      }
      const apiError = toApiError(err);
      if (apiError.code === 'STORE_POSSIBLE_DUPLICATE') {
        setCandidates((apiError.details as StoreDuplicateDetails).candidates);
      } else if (apiError.code === 'OUTSIDE_COVERAGE') {
        setFailure('Ese punto está fuera de Argentina. Mové el pin al comercio.');
      } else if (apiError.code === 'VALIDATION_FAILED') {
        setFailure('Revisá el nombre y la dirección.');
      } else if (apiError.code === 'DAILY_LIMIT_REACHED') {
        setFailure('Llegaste al máximo de comercios nuevos de hoy. Se renueva a las 00:00.');
      } else if (apiError.code === 'RATE_LIMITED') {
        setFailure(
          `Estás yendo muy rápido. Probá de nuevo en ${apiError.retryAfterSeconds ?? 60} segundos.`,
        );
      } else if (apiError.code === 'TURNSTILE_FAILED') {
        setFailure('No pudimos verificar que sos una persona. Probá de nuevo.');
      } else {
        setFailure(`No pudimos guardar el comercio (${apiError.displayCode}). Probá de nuevo.`);
      }
    } finally {
      setBusy(false);
    }
  };

  if (candidates) {
    const nearest = candidates[0];
    return (
      <LoadLayout
        step={1}
        title="Agregar comercio"
        back={null}
        footer={
          <button
            type="button"
            onClick={() => void submit(true)}
            disabled={busy}
            className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl border border-line-strong bg-white text-base font-semibold text-ink disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'No, es otro comercio'}
          </button>
        }
      >
        <Notice tone="warn">
          <strong>¿Es alguno de estos?</strong> Encontramos{' '}
          {candidates.length === 1
            ? 'un comercio parecido'
            : `${candidates.length} comercios parecidos`}
          {nearest && ` a ${formatDistance(nearest.distanceM)}`}. Si es el mismo, usalo así no queda
          repetido.
        </Notice>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {candidates.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-[14px] border-2 border-ink bg-white px-4 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{c.name}</div>
                <div className="text-[13px] text-muted">
                  {c.address} · a {formatDistance(c.distanceM)} ·{' '}
                  {c.reportCount === 1 ? '1 oferta' : `${c.reportCount} ofertas`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => pickStore(c)}
                className="min-h-11 cursor-pointer rounded-[10px] border-0 bg-ink px-3.5 text-sm font-semibold text-white"
              >
                Es este
              </button>
            </li>
          ))}
        </ul>
        {failure && (
          <Notice tone="danger" role="alert">
            {failure}
          </Notice>
        )}
      </LoadLayout>
    );
  }

  const inputClass = (invalid: boolean) =>
    `h-13 rounded-xl bg-white px-3.5 text-base text-ink ${invalid ? 'border-2 border-danger' : 'border border-line-strong'}`;

  return (
    <LoadLayout
      step={1}
      title="Agregar comercio"
      back="/cargar"
      footer={
        <PrimaryButton onClick={() => void submit(false)} busy={busy}>
          {busy ? 'Guardando…' : 'Guardar y continuar'}
        </PrimaryButton>
      }
    >
      {failure && (
        <Notice tone="danger" role="alert">
          {failure}
        </Notice>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.name} className="text-sm font-semibold">
          Nombre
        </label>
        <input
          id={ids.name}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? `${ids.name}-error` : undefined}
          className={inputClass(!!errors.name)}
        />
        {errors.name && (
          <span id={`${ids.name}-error`} className="text-[13px] font-medium text-danger">
            {errors.name}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.address} className="text-sm font-semibold">
          Dirección
        </label>
        <input
          id={ids.address}
          value={address}
          maxLength={120}
          placeholder="Calle y altura, o una referencia"
          onChange={(e) => setAddress(e.target.value)}
          aria-invalid={!!errors.address}
          aria-describedby={errors.address ? `${ids.address}-error` : undefined}
          className={inputClass(!!errors.address)}
        />
        {errors.address && (
          <span id={`${ids.address}-error`} className="text-[13px] font-medium text-danger">
            {errors.address}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Ubicación</span>
        <Suspense fallback={<div className="h-56 rounded-2xl bg-[#E7EAE2]" />}>
          <PinPicker
            value={pin}
            onChange={(lat, lng) => {
              setPin({ lat, lng });
              setMoved(true);
            }}
          />
        </Suspense>
        <span className="text-[13px] text-muted">
          {moved ? 'Pin ubicado.' : 'Tocá el mapa o arrastrá el pin hasta el comercio.'}
        </span>
      </div>
    </LoadLayout>
  );
}
