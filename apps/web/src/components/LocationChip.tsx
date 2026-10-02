import { Link } from 'react-router';
import { chipLabel, type SavedLocation } from '../lib/location';
import { formatDistance } from '../lib/format';
import { ChevronDownIcon, PinIcon } from './Icons';

export function LocationChip({
  location,
  withRadius = false,
  className = '',
}: {
  location: SavedLocation;
  withRadius?: boolean;
  className?: string;
}) {
  const radius =
    withRadius && location.kind === 'point' ? ` · ${formatDistance(location.radius)}` : '';
  return (
    <Link
      to="/ubicacion"
      aria-label={`Ubicación: ${chipLabel(location)}${radius}. Cambiar`}
      className={`flex min-h-11 min-w-0 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-sm font-medium text-ink no-underline ${className}`}
    >
      <PinIcon size={16} className="shrink-0" />
      <span className="truncate">
        {chipLabel(location)}
        {radius}
      </span>
      <ChevronDownIcon size={14} className="shrink-0" />
    </Link>
  );
}
