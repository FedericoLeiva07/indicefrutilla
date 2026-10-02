import { argentinaDate, type Presentation, shiftDate } from '@indice/shared';

const ars = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export function formatArs(value: number): string {
  return `$${ars.format(Math.round(value))}`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${decimal.format(meters / 1000)} km`;
}

export function formatGrams(grams: number): string {
  if (grams >= 1000 && grams % 100 === 0) return `${decimal.format(grams / 1000)} kg`;
  return `${ars.format(grams)} g`;
}

export function presentationLabel(presentation: Presentation, quantityG: number): string {
  if (presentation === 'cajon') return `Cajón ${formatGrams(quantityG)}`;
  return formatGrams(quantityG);
}

export function offerLine(presentation: Presentation, quantityG: number, priceArs: number): string {
  return `${presentationLabel(presentation, quantityG)} a ${formatArs(priceArs)}`;
}

export function weekLabel(weekStart: string): string {
  return `semana del ${shortDate.format(new Date(`${weekStart}T00:00:00Z`)).replace('.', '')}`;
}

export function relativeObserved(
  observedAt: string,
  createdAt: string,
  now: Date = new Date(),
): string {
  const today = argentinaDate(now);
  if (observedAt === today && argentinaDate(new Date(createdAt)) === today) {
    const minutes = Math.max(
      0,
      Math.round((now.getTime() - new Date(createdAt).getTime()) / 60_000),
    );
    if (minutes < 1) return 'recién';
    if (minutes < 60) return `hace ${minutes} min`;
    return `hace ${Math.floor(minutes / 60)} h`;
  }
  if (observedAt === today) return 'hoy';
  if (observedAt === shiftDate(today, -1)) return 'ayer';
  const days = Math.round(
    (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${observedAt}T00:00:00Z`).getTime()) /
      86_400_000,
  );
  return `hace ${days} días`;
}

export function relativeAge(timestamp: number, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 1) return 'hace instantes';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}
