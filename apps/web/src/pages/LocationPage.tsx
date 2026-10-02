import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertIcon, ChevronLeftIcon, GlobeIcon, TargetIcon } from '../components/Icons';
import { ApiError, toApiError } from '../lib/api';
import { formatDistance } from '../lib/format';
import { currentPosition, type GeolocationFailure, GeolocationError } from '../lib/geolocation';
import { PROVINCE_RADIUS_M, RADIUS_OPTIONS_M, roundCoord } from '../lib/location';
import { useUserLocation } from '../lib/location-context';
import { resolvePoint, useDepartments, useLocalities, useProvinces } from '../lib/queries';

type Problem =
  { kind: 'geo'; reason: GeolocationFailure } | { kind: 'outside' } | { kind: 'api'; code: string };

const DEFAULT_RADIUS_M = 3_000;

export function LocationPage() {
  const { location, setLocation } = useUserLocation();
  const navigate = useNavigate();
  const ids = { province: useId(), department: useId(), locality: useId() };

  const initialRadius =
    location?.kind === 'point' && location.radius <= 10_000 ? location.radius : DEFAULT_RADIUS_M;
  const [radius, setRadius] = useState<number>(initialRadius);
  const [provinceId, setProvinceId] = useState<string>(
    location?.kind === 'point' ? location.provinceId : '',
  );
  const [departmentId, setDepartmentId] = useState<string>(
    location?.kind === 'point' && location.source === 'zone' ? (location.departmentId ?? '') : '',
  );
  const [localityId, setLocalityId] = useState<string>('');
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  const provinces = useProvinces();
  const departments = useDepartments(provinceId || null);
  const localities = useLocalities(departmentId || null);

  const finish = () => navigate('/', { replace: true });

  const locateMe = async () => {
    setLocating(true);
    setProblem(null);
    try {
      const pos = await currentPosition();
      const lat = roundCoord(pos.lat);
      const lng = roundCoord(pos.lng);
      const zone = await resolvePoint(lat, lng);
      setLocation({
        kind: 'point',
        source: 'gps',
        lat,
        lng,
        radius,
        provinceId: zone.province.id,
        departmentId: zone.department.id,
        label: zone.department.name,
      });
      finish();
    } catch (err) {
      if (err instanceof GeolocationError) setProblem({ kind: 'geo', reason: err.kind });
      else {
        const apiError = err instanceof ApiError ? err : toApiError(err);
        setProblem(
          apiError.code === 'OUTSIDE_COVERAGE'
            ? { kind: 'outside' }
            : { kind: 'api', code: apiError.displayCode },
        );
      }
    } finally {
      setLocating(false);
    }
  };

  const chooseZone = () => {
    const province = provinces.data?.find((p) => p.id === provinceId);
    if (!province) return;
    const department = departments.data?.find((d) => d.id === departmentId);
    const locality = localities.data?.find((l) => l.id === localityId);
    if (!department) {
      setLocation({
        kind: 'point',
        source: 'zone',
        ...province.centroid,
        radius: PROVINCE_RADIUS_M,
        provinceId: province.id,
        departmentId: null,
        label: province.name,
      });
    } else {
      const center = locality?.centroid ?? department.centroid;
      setLocation({
        kind: 'point',
        source: 'zone',
        lat: roundCoord(center.lat),
        lng: roundCoord(center.lng),
        radius,
        provinceId: province.id,
        departmentId: department.id,
        label: locality?.name ?? department.name,
      });
    }
    finish();
  };

  const chooseCountry = () => {
    setLocation({ kind: 'country' });
    finish();
  };

  if (problem?.kind === 'outside') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-white text-muted">
          <GlobeIcon size={28} />
        </div>
        <h1 className="m-0 font-display text-2xl font-extrabold tracking-tight">
          Por ahora solo cubrimos Argentina
        </h1>
        <p className="m-0 text-[15px] leading-relaxed text-muted">
          Tu ubicación parece estar fuera del país. Elegí una zona de Argentina para ver precios.
        </p>
        <button
          type="button"
          onClick={() => setProblem(null)}
          className="mt-2 h-14 cursor-pointer self-stretch rounded-2xl border-0 bg-brand font-semibold text-white"
        >
          Elegir una zona
        </button>
        <button
          type="button"
          onClick={chooseCountry}
          className="h-12 cursor-pointer self-stretch border-0 bg-transparent font-semibold text-brand"
        >
          Ver todo el país
        </button>
      </main>
    );
  }

  const selectClass =
    'h-13 rounded-xl border border-line-strong bg-white px-3.5 text-base text-ink disabled:bg-ground disabled:text-muted';

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-5 pt-3 pb-7">
      {location ? (
        <Link
          to="/"
          aria-label="Volver"
          className="-ml-2.5 flex size-11 items-center justify-center text-ink"
        >
          <ChevronLeftIcon size={22} />
        </Link>
      ) : (
        <div className="h-2" />
      )}
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-[30px] leading-tight font-extrabold tracking-tight">
          ¿Dónde buscamos frutillas?
        </h1>
        <p className="m-0 text-[15px] leading-relaxed text-muted">
          Elegí cómo ubicarte. Podés cambiarlo cuando quieras desde el chip de arriba.
        </p>
      </div>

      {problem && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-warn-line bg-warn-soft p-3.5 text-sm leading-snug text-ink"
        >
          <AlertIcon className="mt-0.5 shrink-0 text-warn" />
          <div>
            {problem.kind === 'geo' && problem.reason === 'denied' && (
              <>
                <strong>No tenemos permiso para ubicarte.</strong> Lo bloqueaste en el navegador.
                Podés activarlo en la configuración del navegador o elegir una zona acá abajo.
              </>
            )}
            {problem.kind === 'geo' && problem.reason === 'unavailable' && (
              <>
                <strong>No pudimos obtener tu ubicación.</strong> El GPS tardó o falló. Probá de
                nuevo o elegí una zona acá abajo.
              </>
            )}
            {problem.kind === 'api' && (
              <>
                <strong>No pudimos ubicar tu zona.</strong> Probá de nuevo o elegí una zona acá
                abajo ({problem.code}).
              </>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => void locateMe()}
        disabled={locating}
        className="flex cursor-pointer items-center gap-3.5 rounded-[18px] border-2 border-brand bg-white p-4.5 text-left text-ink disabled:cursor-wait disabled:opacity-70"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <TargetIcon size={22} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">
            {locating ? 'Buscando tu ubicación…' : 'Usar mi ubicación actual'}
          </span>
          <span className="text-[13px] text-muted">Solo la usamos para buscar; no se guarda.</span>
        </span>
      </button>

      <div className="flex items-center gap-3 text-[13px] text-muted">
        <div className="h-px flex-1 bg-line" />o elegí una zona
        <div className="h-px flex-1 bg-line" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.province} className="text-sm font-semibold">
          Provincia
        </label>
        <select
          id={ids.province}
          value={provinceId}
          onChange={(e) => {
            setProvinceId(e.target.value);
            setDepartmentId('');
            setLocalityId('');
          }}
          className={selectClass}
        >
          <option value="">{provinces.isPending ? 'Cargando…' : 'Elegí una provincia'}</option>
          {provinces.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.department} className="text-sm font-semibold">
          Partido o departamento
        </label>
        <select
          id={ids.department}
          value={departmentId}
          disabled={!provinceId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setLocalityId('');
          }}
          className={selectClass}
        >
          <option value="">
            {provinceId ? 'Toda la provincia' : 'Primero elegí la provincia'}
          </option>
          {departments.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.locality} className="text-sm font-semibold">
          Localidad
        </label>
        <select
          id={ids.locality}
          value={localityId}
          disabled={!departmentId}
          onChange={(e) => setLocalityId(e.target.value)}
          className={selectClass}
        >
          <option value="">
            {departmentId ? 'Todo el partido o departamento' : 'Primero elegí el partido'}
          </option>
          {localities.data?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold">Radio de búsqueda</legend>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS_M.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={radius === r}
              onClick={() => setRadius(r)}
              className={`min-h-11 cursor-pointer rounded-full border px-4 text-sm ${
                radius === r
                  ? 'border-ink bg-ink font-semibold text-white'
                  : 'border-line-strong bg-white text-ink'
              }`}
            >
              {formatDistance(r)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex-1" />
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={chooseZone}
          disabled={!provinceId}
          className="h-14 cursor-pointer rounded-2xl border-0 bg-brand font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          Ver precios
        </button>
        <button
          type="button"
          onClick={chooseCountry}
          className="h-12 cursor-pointer border-0 bg-transparent font-semibold text-brand"
        >
          Ver todo el país
        </button>
      </div>
    </main>
  );
}
