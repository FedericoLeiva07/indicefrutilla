import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { PointLocation } from '../lib/location';
import { useUserLocation } from '../lib/location-context';
import { useOnline } from '../lib/online';
import { WifiOffIcon } from './Icons';

export function LoadGuard({ children }: { children: (location: PointLocation) => ReactNode }) {
  const { location } = useUserLocation();
  const online = useOnline();

  if (!online) {
    return (
      <Blocked title="Para cargar un precio hace falta conexión" icon={<WifiOffIcon size={28} />}>
        Tu carga queda guardada en este dispositivo. Volvé cuando tengas señal.
      </Blocked>
    );
  }
  if (location?.kind !== 'point') {
    return (
      <Blocked title="Primero elegí dónde estás">
        Para buscar el comercio necesitamos una zona.{' '}
        <Link to="/ubicacion" className="font-semibold">
          Elegir una zona
        </Link>
      </Blocked>
    );
  }
  return <>{children(location)}</>;
}

function Blocked({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      {icon && (
        <div className="flex size-16 items-center justify-center rounded-full bg-white text-muted">
          {icon}
        </div>
      )}
      <h1 className="m-0 font-display text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="m-0 text-[15px] leading-relaxed text-muted">{children}</p>
      <Link to="/" className="mt-2 flex min-h-11 items-center font-semibold no-underline">
        Volver al inicio
      </Link>
    </main>
  );
}
