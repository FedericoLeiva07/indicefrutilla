import type { ReportItemDto } from '@indice/shared';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import { formatArs } from '../lib/format';
import type { PointLocation } from '../lib/location';

function pinIcon(report: ReportItemDto, selected: boolean, cheapest: boolean): L.DivIcon {
  const tone = selected
    ? 'background:#16211C;color:#fff;border:2px solid #fff'
    : cheapest
      ? 'background:#C81D35;color:#fff;border:2px solid #fff'
      : 'background:#fff;color:#16211C;border:1px solid #C9CFC6';
  return L.divIcon({
    className: 'price-pin',
    html: `<span style="display:inline-block;padding:6px 10px;border-radius:999px;font:600 13px Figtree,sans-serif;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.22);${tone}">${formatArs(report.pricePerKg)}</span>`,
    iconSize: null as unknown as L.PointExpression,
  });
}

function FitRadius({ location }: { location: PointLocation }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      map.fitBounds(L.latLng(location.lat, location.lng).toBounds(location.radius * 2), {
        paddingTopLeft: [12, 80],
        paddingBottomRight: [12, 24],
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, location.lat, location.lng, location.radius]);
  return null;
}

export function PriceMap({
  location,
  reports,
  selectedId,
  onSelect,
  className = '',
}: {
  location: PointLocation;
  reports: ReportItemDto[];
  selectedId: number | null;
  onSelect: (report: ReportItemDto) => void;
  className?: string;
}) {
  const visible = useMemo(() => cheapestPerStore(reports), [reports]);
  const cheapestId = useMemo(
    () =>
      visible.reduce<ReportItemDto | null>(
        (min, r) => (!min || r.pricePerKg < min.pricePerKg ? r : min),
        null,
      )?.id,
    [visible],
  );

  return (
    <MapContainer
      center={[location.lat, location.lng]}
      zoom={14}
      className={className}
      attributionControl
      zoomControl={false}
      zoomSnap={0.25}
      scrollWheelZoom
    >
      <ZoomControl position="bottomleft" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitRadius location={location} />
      <Circle
        center={[location.lat, location.lng]}
        radius={location.radius}
        pathOptions={{ color: '#C81D35', weight: 2, dashArray: '6 6', fillOpacity: 0.05 }}
      />
      <CircleMarker
        center={[location.lat, location.lng]}
        radius={8}
        pathOptions={{ color: '#fff', weight: 3, fillColor: '#16211C', fillOpacity: 1 }}
      />
      {visible.map((report) => (
        <Marker
          key={report.id}
          position={[report.store.location.lat, report.store.location.lng]}
          icon={pinIcon(report, report.id === selectedId, report.id === cheapestId)}
          title={`${report.store.name}: ${formatArs(report.pricePerKg)} por kg`}
          alt={`${report.store.name}: ${formatArs(report.pricePerKg)} por kg`}
          keyboard
          eventHandlers={{
            click: () => onSelect(report),
            add: (e) =>
              (e.target as L.Marker)
                .getElement()
                ?.setAttribute(
                  'aria-label',
                  `${report.store.name}: ${formatArs(report.pricePerKg)} por kg`,
                ),
          }}
        />
      ))}
    </MapContainer>
  );
}

export function cheapestPerStore(reports: ReportItemDto[]): ReportItemDto[] {
  const byStore = new Map<number, ReportItemDto>();
  for (const report of reports) {
    const current = byStore.get(report.store.id);
    if (!current || report.pricePerKg < current.pricePerKg) byStore.set(report.store.id, report);
  }
  return [...byStore.values()];
}
