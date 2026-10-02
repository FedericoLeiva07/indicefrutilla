import type {
  CreateReportRequest,
  CreateReportResponse,
  CreateStoreRequest,
  NearbyStoreDto,
  ReferenceLatestDto,
  StoreDto,
} from '@indice/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { PointLocation } from './location';
import { getTurnstileToken } from './turnstile';

export const STORE_SEARCH_RADIUS_M = 3_000;

export function roundStorePin(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function useNearbyStores(location: PointLocation | null) {
  return useQuery({
    queryKey: ['stores', 'nearby', location?.lat, location?.lng],
    queryFn: async () =>
      (
        await api.get<NearbyStoreDto[]>('/stores/nearby', {
          params: { lat: location!.lat, lng: location!.lng, radius: STORE_SEARCH_RADIUS_M },
        })
      ).data,
    enabled: !!location,
  });
}

export function useStoreSearch(location: PointLocation | null, q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ['stores', 'search', location?.lat, location?.lng, term],
    queryFn: async ({ signal }) =>
      (
        await api.get<NearbyStoreDto[]>('/stores/search', {
          params: {
            q: term,
            lat: location!.lat,
            lng: location!.lng,
            radius: STORE_SEARCH_RADIUS_M,
          },
          signal,
        })
      ).data,
    enabled: !!location && term.length >= 2,
  });
}

export function useReferenceLatest() {
  return useQuery({
    queryKey: ['reference', 'latest'],
    queryFn: async () => (await api.get<ReferenceLatestDto>('/reference/latest')).data,
    staleTime: 10 * 60_000,
  });
}

export async function createStore(
  body: Omit<CreateStoreRequest, 'turnstileToken'>,
  idempotencyKey: string,
): Promise<StoreDto> {
  const turnstileToken = await getTurnstileToken();
  return (
    await api.post<StoreDto>(
      '/stores',
      { ...body, turnstileToken },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
  ).data;
}

export async function createReport(
  body: Omit<CreateReportRequest, 'turnstileToken'>,
  idempotencyKey: string,
): Promise<CreateReportResponse> {
  const turnstileToken = await getTurnstileToken();
  return (
    await api.post<CreateReportResponse>(
      '/reports',
      { ...body, turnstileToken },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
  ).data;
}
