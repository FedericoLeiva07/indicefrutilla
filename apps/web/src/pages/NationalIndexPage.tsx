import {
  INDEX_PUBLISH_THRESHOLD,
  type IndexWindow,
  type ProvinceIndexRowDto,
} from '@indice/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { ErrorState } from '../components/States';
import { useProvinceIndex } from '../lib/community-api';
import { formatArs, weekLabel } from '../lib/format';
import { PROVINCE_RADIUS_M } from '../lib/location';
import { useUserLocation } from '../lib/location-context';
import { useProvinces } from '../lib/queries';

const WINDOWS: Array<{ value: IndexWindow; label: string }> = [
  { value: 1, label: 'Esta semana' },
  { value: 4, label: 'Últimas 4' },
  { value: 12, label: 'Últimas 12' },
];

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted">—</span>;
  if (pct === 0) return <span className="text-muted">= 0%</span>;
  return (
    <span className={pct < 0 ? 'text-leaf' : 'text-brand-dark'}>
      {pct < 0 ? '▼' : '▲'} {Math.abs(pct)}%
    </span>
  );
}

export function NationalIndexPage() {
  const [weeks, setWeeks] = useState<IndexWindow>(1);
  const index = useProvinceIndex(weeks);
  const provinces = useProvinces();
  const { setLocation } = useUserLocation();
  const navigate = useNavigate();

  const data = index.data;
  const published = data?.provinces.filter((p) => p.published) ?? [];
  const scaleMin = Math.min(...published.map((p) => p.p25Ppk ?? Infinity)) * 0.9;
  const scaleMax = Math.max(...published.map((p) => p.p75Ppk ?? 0)) * 1.05;
  const pos = (v: number) => `${((v - scaleMin) / Math.max(1, scaleMax - scaleMin)) * 100}%`;

  const openProvince = (row: ProvinceIndexRowDto) => {
    const province = provinces.data?.find((p) => p.id === row.provinceId);
    if (!province) return;
    setLocation({
      kind: 'point',
      source: 'zone',
      ...province.centroid,
      radius: PROVINCE_RADIUS_M,
      provinceId: province.id,
      departmentId: null,
      label: province.name,
    });
    navigate('/');
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-5 pt-3 pb-10">
      <PageHeader />
      <h1 className="m-0 font-display text-[30px] leading-tight font-extrabold tracking-tight">
        Índice nacional
      </h1>

      <div
        role="group"
        aria-label="Período"
        className="grid grid-cols-3 rounded-2xl border border-line bg-white p-1"
      >
        {WINDOWS.map((w) => (
          <button
            key={w.value}
            type="button"
            aria-pressed={weeks === w.value}
            onClick={() => setWeeks(w.value)}
            className={`min-h-10 cursor-pointer rounded-[10px] border-0 text-sm font-semibold ${
              weeks === w.value ? 'bg-ink text-white' : 'bg-transparent text-ink'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {index.isPending ? (
        <div aria-busy="true" className="h-40 rounded-[20px] bg-skeleton" />
      ) : index.isError || !data ? (
        <ErrorState error={index.error} onRetry={() => void index.refetch()} />
      ) : (
        <>
          <section className="flex flex-col gap-1 rounded-[20px] border border-line bg-white p-5">
            <div className="text-[13px] text-muted">
              Mediana nacional · {weeks === 1 ? weekLabel(data.from) : `últimas ${weeks} semanas`}
            </div>
            {data.country.published ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-[48px] leading-[1.05] font-extrabold tracking-tight">
                    {formatArs(data.country.medianPpk!)}
                  </span>
                  <span className="text-base text-muted">/kg</span>
                </div>
                <div className="text-[13px] font-semibold">
                  {weeks === 1 && (
                    <>
                      <Change pct={data.country.weeklyChangePct} />
                      {data.country.weeklyChangePct !== null && (
                        <span className="text-muted"> contra la semana anterior · </span>
                      )}
                    </>
                  )}
                  <span className="font-normal text-muted">{data.country.sampleSize} ofertas</span>
                </div>
              </>
            ) : (
              <p className="m-0 text-sm text-muted">
                Todavía no hay datos suficientes en el país para este período.
              </p>
            )}
          </section>

          <div className="overflow-x-auto rounded-[20px] border border-line bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Mediana por kg de cada provincia</caption>
              <thead>
                <tr className="border-b border-divider text-xs text-muted">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Provincia
                  </th>
                  <th scope="col" className="px-2 py-3 text-right font-medium">
                    Mediana $/kg
                  </th>
                  {weeks === 1 && (
                    <th scope="col" className="px-2 py-3 text-right font-medium">
                      Semana
                    </th>
                  )}
                  <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">
                    p25–p75
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Ofertas
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.provinces.map((row) => (
                  <tr key={row.provinceId} className="border-b border-divider last:border-0">
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {row.published ? (
                        <button
                          type="button"
                          onClick={() => openProvince(row)}
                          className="cursor-pointer border-0 bg-transparent p-0 text-left font-semibold text-ink underline decoration-line-strong underline-offset-4"
                        >
                          {row.name}
                        </button>
                      ) : (
                        <>
                          <span>{row.name}</span>
                          <span className="block text-xs font-normal text-muted">
                            Sin datos suficientes
                          </span>
                        </>
                      )}
                    </th>
                    <td className="px-2 py-3 text-right font-semibold whitespace-nowrap">
                      {row.medianPpk === null ? '—' : formatArs(row.medianPpk)}
                    </td>
                    {weeks === 1 && (
                      <td className="px-2 py-3 text-right text-[13px] font-semibold whitespace-nowrap">
                        <Change pct={row.weeklyChangePct} />
                      </td>
                    )}
                    <td className="hidden w-[38%] px-4 py-3 sm:table-cell">
                      {row.p25Ppk !== null && row.p75Ppk !== null && row.medianPpk !== null && (
                        <div
                          className="relative h-2 rounded bg-ground"
                          role="img"
                          aria-label={`De ${formatArs(row.p25Ppk)} a ${formatArs(row.p75Ppk)}`}
                        >
                          <div
                            className="absolute inset-y-0 rounded bg-brand-tint"
                            style={{
                              left: pos(row.p25Ppk),
                              right: `calc(100% - ${pos(row.p75Ppk)})`,
                            }}
                          />
                          <div
                            className="absolute -inset-y-1 w-0.5 bg-brand"
                            style={{ left: pos(row.medianPpk) }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{row.sampleSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-xs leading-relaxed text-muted">
            La barra muestra la mitad central de los precios (de p25 a p75) y la línea, la mediana.
            Solo entran ofertas de calidad Primera, y una provincia se publica con al menos{' '}
            {INDEX_PUBLISH_THRESHOLD.reports} ofertas de {INDEX_PUBLISH_THRESHOLD.stores} comercios.
          </p>
        </>
      )}
    </main>
  );
}
