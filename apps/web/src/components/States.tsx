import { Link } from 'react-router';
import { ApiError } from '../lib/api';
import { relativeAge } from '../lib/format';
import { AlertIcon, WifiOffIcon } from './Icons';

export function OfflineBanner({ savedAt }: { savedAt: number | null }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-2xl border border-offline-line bg-offline px-3.5 py-3 text-sm leading-snug"
    >
      <WifiOffIcon className="mt-0.5 shrink-0" />
      <div>
        <strong>Sin conexión.</strong>{' '}
        {savedAt
          ? `Estás viendo los precios guardados ${relativeAge(savedAt)}. Se actualizan solos cuando vuelva la señal.`
          : 'Todavía no hay precios guardados en este dispositivo.'}
      </div>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = 'No pudimos cargar los precios',
}: {
  error: unknown;
  onRetry: () => void;
  title?: string;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const network = apiError?.code === 'NETWORK';
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertIcon size={28} />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm leading-relaxed text-muted">
        {network
          ? 'No hay conexión o el servidor tardó demasiado en responder. Probá de nuevo en unos segundos.'
          : 'Es un problema momentáneo de nuestro lado. Probá de nuevo en unos segundos.'}{' '}
        Si sigue pasando, avisanos con el código{' '}
        <strong className="text-ink">{apiError?.displayCode ?? 'E-RED'}</strong>.
      </p>
      <div className="flex flex-col items-stretch gap-2 self-stretch sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onRetry}
          className="h-12 cursor-pointer rounded-2xl border-0 bg-brand px-6 font-semibold text-white"
        >
          Reintentar
        </button>
        <Link
          to="/"
          className="flex h-12 items-center justify-center px-4 font-semibold no-underline"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
