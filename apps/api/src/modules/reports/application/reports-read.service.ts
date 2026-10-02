import { Injectable } from '@nestjs/common';
import {
  ACTIVE_REPORT_DAYS,
  COMMUNITY_THRESHOLDS,
  argentinaDate,
  ErrorCode,
  type ReportItemDto,
  type ReportListDto,
  type ReportSort,
  type ReportUnavailableDetails,
  shiftDate,
} from '@indice/shared';
import { AppException } from '../../../common/app-exception';
import { ReportsQueries } from '../infra/reports.queries';

export const REPORTS_PAGE_SIZE = 20;

export function activeSince(now: Date = new Date()): string {
  return shiftDate(argentinaDate(now), -(ACTIVE_REPORT_DAYS - 1));
}

@Injectable()
export class ReportsReadService {
  constructor(private readonly queries: ReportsQueries) {}

  async list(params: {
    lat: number;
    lng: number;
    radius: number;
    sort: ReportSort;
    cursor?: string;
    deviceId: string | null;
  }): Promise<ReportListDto> {
    const offset = params.cursor ? Number(params.cursor) : 0;
    const { items, total } = await this.queries.list({
      ...params,
      since: activeSince(),
      offset,
      limit: REPORTS_PAGE_SIZE,
    });
    const next = offset + items.length;
    return { items, total, nextCursor: next < total ? String(next) : null };
  }

  async detail(id: number, deviceId: string | null): Promise<ReportItemDto> {
    const report = await this.queries.findById(id, deviceId);
    if (!report) throw new AppException(ErrorCode.NotFound, 404, 'No existe esa oferta');
    const { status, voteBalance, ...item } = report;
    assertActive({ status, voteBalance, observedAt: item.observedAt });
    return item;
  }
}

export function assertActive(report: {
  status: string;
  voteBalance: number;
  observedAt: string;
}): void {
  if (report.status === 'flagged')
    throw unavailable('flagged', 'La oferta fue denunciada y se quitó');
  if (report.observedAt < activeSince()) {
    throw unavailable('expired', 'La oferta tiene más de 7 días y ya no se muestra');
  }
  if (report.voteBalance <= COMMUNITY_THRESHOLDS.minVoteBalance) {
    throw unavailable('downvoted', 'La comunidad marcó que el precio ya no está');
  }
}

function unavailable(reason: ReportUnavailableDetails['reason'], message: string): AppException {
  const details: ReportUnavailableDetails = { reason };
  return new AppException(ErrorCode.ReportUnavailable, 410, message, details);
}
