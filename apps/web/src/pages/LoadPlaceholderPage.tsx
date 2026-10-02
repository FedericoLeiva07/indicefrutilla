import { Link } from 'react-router';
import { ChevronLeftIcon } from '../components/Icons';

export function LoadPlaceholderPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-3">
      <Link
        to="/"
        aria-label="Volver"
        className="-ml-2.5 flex size-11 items-center justify-center text-ink"
      >
        <ChevronLeftIcon size={22} />
      </Link>
      <h1 className="m-0 font-display text-3xl font-extrabold tracking-tight">Cargar precio</h1>
      <p className="m-0 text-[15px] leading-relaxed text-muted">
        Muy pronto vas a poder cargar el precio de la frutilla en un comercio de tu zona.
      </p>
    </main>
  );
}
