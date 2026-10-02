import type {
  DepartmentDto,
  IndexSummaryDto,
  LocalityDto,
  ProvinceDto,
  ReportListDto,
  ReportSort,
  ResolvedLocationDto,
} from '@indice/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from './api';
import { type PointLocation, type SavedLocation, summaryZone } from './location';

const DAY = 86_400_000;

export const PERSISTED_QUERY_ROOTS = ['summary', 'reports'] as const;

export function useProvinces() {
  return useQuery({
    queryKey: ['geo', 'provinces'],
    queryFn: async () => (await api.get<ProvinceDto[]>('/geo/provinces')).data,
    staleTime: DAY,
  });
}

export function useDepartments(provinceId: string | null) {
  return useQuery({
    queryKey: ['geo', 'departments', provinceId],
    queryFn: async () =>
      (await api.get<DepartmentDto[]>(`/geo/provinces/${provinceId}/departments`)).data,
    enabled: !!provinceId,
    staleTime: DAY,
  });
}

export function useLocalities(departmentId: string | null) {
  return useQuery({
    queryKey: ['geo', 'localities', departmentId],
    queryFn: async () =>
      (await api.get<LocalityDto[]>(`/geo/departments/${departmentId}/localities`)).data,
    enabled: !!departmentId,
    staleTime: DAY,
  });
}

export async function resolvePoint(lat: number, lng: number): Promise<ResolvedLocationDto> {
  return (await api.get<ResolvedLocationDto>('/geo/resolve', { params: { lat, lng } })).data;
}

export function useIndexSummary(location: SavedLocation | null) {
  const zone = location ? summaryZone(location) : {};
  return useQuery({
    queryKey: ['summary', zone],
    queryFn: async () => (await api.get<IndexSummaryDto>('/index/summary', { params: zone })).data,
    enabled: !!location,
  });
}

function reportParams(location: PointLocation, sort: ReportSort) {
  return { lat: location.lat, lng: location.lng, radius: location.radius, sort };
}

export function useReports(location: SavedLocation | null, sort: ReportSort) {
  const point = location?.kind === 'point' ? location : null;
  return useInfiniteQuery({
    queryKey: ['reports', point && reportParams(point, sort)],
    queryFn: async ({ pageParam }) =>
      (
        await api.get<ReportListDto>('/reports', {
          params: { ...reportParams(point!, sort), cursor: pageParam ?? undefined },
        })
      ).data,
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!point,
  });
}

export const MAP_MAX_REPORTS = 100;

export function useMapReports(location: SavedLocation | null) {
  const point = location?.kind === 'point' ? location : null;
  return useQuery({
    queryKey: ['reports', 'map', point && reportParams(point, 'distance')],
    queryFn: async () => {
      const items: ReportListDto['items'] = [];
      let cursor: string | null = null;
      let total: number;
      do {
        const { data }: { data: ReportListDto } = await api.get<ReportListDto>('/reports', {
          params: { ...reportParams(point!, 'distance'), cursor: cursor ?? undefined },
        });
        items.push(...data.items);
        total = data.total;
        cursor = data.nextCursor;
      } while (cursor && items.length < MAP_MAX_REPORTS);
      return { items, total };
    },
    enabled: !!point,
  });
}
