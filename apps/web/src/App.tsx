import type { ProvinceDto } from '@indice/shared';
import { useQuery } from '@tanstack/react-query';
import { api, toApiError } from './lib/api';

function Logo() {
  return (
    <svg viewBox="0 0 100 100" width="30" height="30" aria-hidden="true">
      <path
        d="M50 94C28 82 10 60 12 40C14 26 28 22 50 26C72 22 86 26 88 40C90 60 72 82 50 94Z"
        fill="#C81D35"
      />
      <path
        d="M26 30C34 18 44 18 50 25C56 18 66 18 74 30C64 27 57 29 50 34C43 29 36 27 26 30Z"
        fill="#1F6B4A"
      />
      <rect x="34" y="56" width="7" height="12" rx="3.5" fill="#FFFFFF" />
      <rect x="46.5" y="48" width="7" height="20" rx="3.5" fill="#FFFFFF" />
      <rect x="59" y="40" width="7" height="28" rx="3.5" fill="#FFFFFF" />
    </svg>
  );
}

export function App() {
  const provinces = useQuery({
    queryKey: ['geo', 'provinces'],
    queryFn: async () => (await api.get<ProvinceDto[]>('/geo/provinces')).data,
  });

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-5 py-6">
      <header className="flex items-center gap-1.5">
        <Logo />
        <span className="font-display text-2xl leading-none font-extrabold tracking-tight">
          Índice
        </span>
      </header>
      <section className="rounded-2xl border border-line bg-white p-5">
        <h1 className="font-display text-xl font-semibold">En construcción</h1>
        {provinces.isPending && <p className="text-muted">Conectando con la API…</p>}
        {provinces.isError && (
          <p className="text-danger">
            No pudimos conectar con la API ({toApiError(provinces.error).displayCode}).
          </p>
        )}
        {provinces.isSuccess && (
          <p className="text-muted">API conectada: {provinces.data.length} provincias cargadas.</p>
        )}
      </section>
    </main>
  );
}
