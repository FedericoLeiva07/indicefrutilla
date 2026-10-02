import { Link } from 'react-router';
import { formatDistance } from '../lib/format';
import { type PointLocation, PROVINCE_RADIUS_M } from '../lib/location';
import { useUserLocation } from '../lib/location-context';
import { useProvinces } from '../lib/queries';
import { SearchIcon } from './Icons';

const WIDE_RADIUS_M = 10_000;

export function EmptyNearby({ location, online }: { location: PointLocation; online: boolean }) {
  const { setLocation } = useUserLocation();
  const provinces = useProvinces();
  const province = provinces.data?.find((p) => p.id === location.provinceId);
  const isProvinceView = location.departmentId === null;

  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full border border-dashed border-line-strong bg-white text-muted">
        <SearchIcon size={28} />
      </div>
      <h2 className="m-0 text-lg font-semibold">
        No hay precios cargados a menos de {formatDistance(location.radius)}
      </h2>
      <p className="m-0 text-sm leading-relaxed text-muted">
        Ampliá la búsqueda o sé la primera persona en cargar uno.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        {location.radius < WIDE_RADIUS_M && (
          <button
            type="button"
            onClick={() => setLocation({ ...location, radius: WIDE_RADIUS_M })}
            className="min-h-11 cursor-pointer rounded-full border border-line-strong bg-white px-4 text-sm font-semibold text-ink"
          >
            Ampliar a 10 km
          </button>
        )}
        {!isProvinceView && province && (
          <button
            type="button"
            onClick={() =>
              setLocation({
                kind: 'point',
                source: 'zone',
                lat: province.centroid.lat,
                lng: province.centroid.lng,
                radius: PROVINCE_RADIUS_M,
                provinceId: province.id,
                departmentId: null,
                label: province.name,
              })
            }
            className="min-h-11 cursor-pointer rounded-full border border-line-strong bg-white px-4 text-sm font-semibold text-ink"
          >
            Ver la provincia
          </button>
        )}
      </div>
      {online && (
        <Link
          to="/cargar"
          className="mt-2 flex h-14 items-center justify-center self-stretch rounded-2xl bg-brand font-semibold text-white no-underline hover:text-white"
        >
          Cargar el primer precio
        </Link>
      )}
    </div>
  );
}
