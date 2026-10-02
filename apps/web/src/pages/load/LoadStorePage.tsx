import type { NearbyStoreDto } from '@indice/shared';
import { useDeferredValue, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PlusIcon, SearchIcon } from '../../components/Icons';
import { LoadGuard } from '../../components/LoadGuard';
import { LoadLayout, PrimaryButton } from '../../components/LoadLayout';
import { ErrorState } from '../../components/States';
import { useDraft } from '../../lib/draft-context';
import { formatDistance } from '../../lib/format';
import { STORE_SEARCH_RADIUS_M, useNearbyStores, useStoreSearch } from '../../lib/load-api';
import type { PointLocation } from '../../lib/location';

export function LoadStorePage() {
  return <LoadGuard>{(location) => <StoreStep location={location} />}</LoadGuard>;
}

function StoreStep({ location }: { location: PointLocation }) {
  const { draft, update } = useDraft();
  const navigate = useNavigate();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const searching = deferred.trim().length >= 2;
  const nearby = useNearbyStores(location);
  const search = useStoreSearch(location, deferred);
  const list = searching ? search : nearby;
  const [selectedId, setSelectedId] = useState<number | null>(draft.store?.id ?? null);

  const choose = (store: NearbyStoreDto) => setSelectedId(store.id);

  const stores = list.data ?? [];
  const selected =
    stores.find((s) => s.id === selectedId) ??
    (draft.store && draft.store.id === selectedId ? draft.store : null);

  const next = () => {
    if (!selected) return;
    update({
      store: {
        id: selected.id,
        name: selected.name,
        address: selected.address,
        location: selected.location,
      },
    });
    navigate('/cargar/precio');
  };

  const addLink = `/cargar/comercio-nuevo${searching ? `?nombre=${encodeURIComponent(deferred.trim())}` : ''}`;

  return (
    <LoadLayout
      step={1}
      title="¿Dónde las viste?"
      back={null}
      footer={
        <div className="flex flex-col gap-1.5">
          <PrimaryButton onClick={next} disabled={!selected}>
            Continuar
          </PrimaryButton>
          {!selected && (
            <span className="text-center text-[13px] text-muted">
              Elegí o agregá un comercio para seguir
            </span>
          )}
        </div>
      }
    >
      <label
        htmlFor={searchId}
        className="flex h-13 items-center gap-2.5 rounded-[14px] border border-line-strong bg-white px-3.5 text-muted focus-within:border-2 focus-within:border-ink"
      >
        <SearchIcon size={18} />
        <span className="sr-only">Buscar comercio</span>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar verdulería o frutería"
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none"
        />
      </label>

      {draft.store && !stores.some((s) => s.id === draft.store!.id) && !searching && (
        <StoreOption
          name={draft.store.name}
          detail={draft.store.address}
          checked={selectedId === draft.store.id}
          onSelect={() => setSelectedId(draft.store!.id)}
        />
      )}

      <div className="text-[13px] font-semibold text-muted">
        {searching ? 'Resultados' : 'Cerca tuyo'}
      </div>

      {list.isPending && list.fetchStatus !== 'idle' ? (
        <p className="m-0 text-sm text-muted">Buscando comercios…</p>
      ) : list.isError ? (
        <ErrorState
          error={list.error}
          onRetry={() => void list.refetch()}
          title="No pudimos buscar comercios"
        />
      ) : stores.length === 0 && searching ? (
        <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-line bg-white px-5 py-6 text-center">
          <SearchIcon size={28} className="text-muted" />
          <div className="text-base font-semibold">
            No encontramos "{deferred.trim()}" a menos de {formatDistance(STORE_SEARCH_RADIUS_M)}
          </div>
          <div className="text-sm leading-relaxed text-muted">
            Revisá el nombre o agregalo como comercio nuevo.
          </div>
          <Link
            to={addLink}
            className="mt-1 flex min-h-12 items-center gap-2 rounded-xl bg-ink px-4.5 text-[15px] font-semibold text-white no-underline hover:text-white"
          >
            <PlusIcon size={18} />
            Agregar "{deferred.trim()}"
          </Link>
        </div>
      ) : stores.length === 0 ? (
        <p className="m-0 text-sm text-muted">
          Todavía no hay comercios cargados cerca. Agregá el primero.
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label={searching ? 'Resultados' : 'Comercios cercanos'}
          className="flex flex-col gap-2"
        >
          {stores.map((store) => (
            <StoreOption
              key={store.id}
              name={store.name}
              detail={store.address}
              distance={formatDistance(store.distanceM)}
              checked={store.id === selectedId}
              onSelect={() => choose(store)}
            />
          ))}
        </div>
      )}

      {!(stores.length === 0 && searching) && (
        <Link
          to={addLink}
          className="flex min-h-13 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-[#9AA39C] text-[15px] font-semibold text-ink no-underline"
        >
          <PlusIcon size={18} />
          No está en la lista: agregar comercio
        </Link>
      )}
    </LoadLayout>
  );
}

function StoreOption({
  name,
  detail,
  distance,
  checked,
  onSelect,
}: {
  name: string;
  detail: string;
  distance?: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex cursor-pointer items-center gap-3 rounded-[14px] bg-white px-4 py-3.5 text-left text-ink ${
        checked ? 'border-2 border-brand' : 'border border-line'
      }`}
    >
      <span
        className={`size-5 shrink-0 rounded-full ${checked ? 'border-[6px] border-brand' : 'border-2 border-[#9AA39C]'}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{name}</span>
        <span className="block truncate text-[13px] text-muted">{detail}</span>
      </span>
      {distance && <span className="text-[13px] whitespace-nowrap text-muted">{distance}</span>}
    </button>
  );
}
