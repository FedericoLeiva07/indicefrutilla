import type {
  FlagReason,
  FlagResponse,
  IndexHistoryRowDto,
  IndexLevel,
  IndexWindow,
  ProvinceIndexDto,
  ReportItemDto,
  VoteResponse,
  VoteValue,
} from '@indice/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export function useReportDetail(id: number) {
  return useQuery({
    queryKey: ['report', id],
    queryFn: async () => (await api.get<ReportItemDto>(`/reports/${id}`)).data,
    retry: false,
    staleTime: 0,
  });
}

export async function voteReport(id: number, value: VoteValue): Promise<VoteResponse> {
  return (await api.post<VoteResponse>(`/reports/${id}/votes`, { value })).data;
}

export async function flagReport(id: number, reason: FlagReason): Promise<FlagResponse> {
  return (await api.post<FlagResponse>(`/reports/${id}/flags`, { reason })).data;
}

export function useProvinceIndex(weeks: IndexWindow) {
  return useQuery({
    queryKey: ['index', 'provinces', weeks],
    queryFn: async () =>
      (await api.get<ProvinceIndexDto>('/index/provinces', { params: { weeks } })).data,
  });
}

export function useIndexHistory(level: IndexLevel, id: string, weeks = 12) {
  return useQuery({
    queryKey: ['index', 'history', level, id, weeks],
    queryFn: async () =>
      (await api.get<IndexHistoryRowDto[]>('/index/history', { params: { level, id, weeks } }))
        .data,
  });
}
