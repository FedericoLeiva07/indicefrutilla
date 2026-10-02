export type GeolocationFailure = 'denied' | 'unavailable';

export class GeolocationError extends Error {
  constructor(readonly kind: GeolocationFailure) {
    super(kind);
  }
}

export const GEOLOCATION_TIMEOUT_MS = 10_000;

export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new GeolocationError('unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(new GeolocationError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')),
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 300_000, enableHighAccuracy: false },
    );
  });
}
