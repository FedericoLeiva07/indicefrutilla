import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';

const pin = L.divIcon({
  className: 'map-pin',
  html: '<span style="display:block;width:26px;height:26px;transform:translate(-50%,-100%);border-radius:50% 50% 50% 0;rotate:-45deg;background:#C81D35;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></span>',
  iconSize: [0, 0],
});

function ClickToMove({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function PinPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number };
  onChange: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer
      center={[value.lat, value.lng]}
      zoom={16}
      className="h-56 w-full overflow-hidden rounded-2xl border border-line"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToMove onChange={onChange} />
      <Marker
        position={[value.lat, value.lng]}
        icon={pin}
        draggable
        keyboard
        title="Ubicación del comercio"
        alt="Ubicación del comercio"
        eventHandlers={{
          dragend: (e) => {
            const p = (e.target as L.Marker).getLatLng();
            onChange(p.lat, p.lng);
          },
        }}
      />
    </MapContainer>
  );
}
