import { Injectable } from '@nestjs/common';
import {
  argentinaDate,
  COUNTRY_ZONE_ID,
  ErrorCode,
  INDEX_HISTORY_WEEKS,
  IndexLevel,
  type IndexHistoryPointDto,
  type IndexLevelDto,
  type IndexSummaryDto,
  shiftDate,
  weekStart,
} from '@indice/shared';
import { DataSource } from 'typeorm';
import { AppException } from '../../../common/app-exception';
import { ReferenceService } from '../../reference/application/reference.service';
import { ReferenceQueries } from '../../reference/infra/reference.queries';
import { type IndexRow, PriceIndexQueries } from '../infra/price-index.queries';

interface Zone {
  level: IndexLevel;
  id: string;
  name: string;
}

const COUNTRY: Zone = { level: IndexLevel.Country, id: COUNTRY_ZONE_ID, name: 'Argentina' };

@Injectable()
export class PriceIndexService {
  constructor(
    private readonly queries: PriceIndexQueries,
    private readonly reference: ReferenceService,
    private readonly referenceQueries: ReferenceQueries,
    private readonly dataSource: DataSource,
  ) {}

  async recomputeRecent(now: Date = new Date()): Promise<void> {
    const current = weekStart(argentinaDate(now));
    await this.queries.recompute(shiftDate(current, -7));
    await this.queries.recompute(current);
  }

  async summary(
    zone: { departmentId?: string; provinceId?: string },
    now: Date = new Date(),
  ): Promise<IndexSummaryDto> {
    const chain = await this.chain(zone);
    const current = weekStart(argentinaDate(now));
    const weeks = Array.from({ length: INDEX_HISTORY_WEEKS }, (_, i) =>
      shiftDate(current, -7 * (INDEX_HISTORY_WEEKS - 1 - i)),
    );
    const rows = await this.queries.rows(weeks, chain);
    const find = (z: Zone, week: string) =>
      rows.find((r) => r.level === z.level && r.zoneId === z.id && r.weekStart === week);

    const levels = chain.map((z) => toLevel(z, find(z, current), find(z, shiftDate(current, -7))));
    const shown = levels.find((l) => l.published) ?? null;
    const shownZone = shown && chain.find((z) => z.level === shown.level);

    const history: IndexHistoryPointDto[] = shownZone
      ? weeks.map((w) => {
          const row = find(shownZone, w);
          return { weekStart: w, medianPpk: row?.published ? row.medianPpk : null };
        })
      : await this.referenceHistory(weeks);

    return {
      weekStart: current,
      levels,
      shown,
      history,
      reference: await this.reference.latest(now),
    };
  }

  private async referenceHistory(weeks: string[]): Promise<IndexHistoryPointDto[]> {
    const medians = await this.referenceQueries.weeklyMedians(weeks[0]!);
    return weeks.map((w) => ({ weekStart: w, medianPpk: medians.get(w) ?? null }));
  }

  private async chain(zone: { departmentId?: string; provinceId?: string }): Promise<Zone[]> {
    if (zone.departmentId) {
      const rows: Array<{ did: string; dname: string; pid: string; pname: string }> =
        await this.dataSource.query(
          `SELECT d.id AS did, d.name AS dname, p.id AS pid, p.name AS pname
             FROM departments d JOIN provinces p ON p.id = d.province_id
            WHERE d.id = $1`,
          [zone.departmentId],
        );
      const row = rows[0];
      if (!row) throw notFound('departamento');
      return [
        { level: IndexLevel.Department, id: row.did, name: row.dname },
        { level: IndexLevel.Province, id: row.pid, name: row.pname },
        COUNTRY,
      ];
    }
    if (zone.provinceId) {
      const rows: Array<{ id: string; name: string }> = await this.dataSource.query(
        `SELECT id, name FROM provinces WHERE id = $1`,
        [zone.provinceId],
      );
      const row = rows[0];
      if (!row) throw notFound('provincia');
      return [{ level: IndexLevel.Province, id: row.id, name: row.name }, COUNTRY];
    }
    return [COUNTRY];
  }
}

function toLevel(
  zone: Zone,
  row: IndexRow | undefined,
  previous: IndexRow | undefined,
): IndexLevelDto {
  const published = row?.published ?? false;
  const median = published ? (row?.medianPpk ?? null) : null;
  const previousMedian = previous?.published ? previous.medianPpk : null;
  return {
    level: zone.level,
    id: zone.id,
    name: zone.name,
    published,
    medianPpk: median,
    p25Ppk: published ? (row?.p25Ppk ?? null) : null,
    p75Ppk: published ? (row?.p75Ppk ?? null) : null,
    sampleSize: row?.sampleSize ?? 0,
    storeCount: row?.storeCount ?? 0,
    weeklyChangePct:
      median !== null && previousMedian
        ? Math.round(((median - previousMedian) / previousMedian) * 100)
        : null,
  };
}

function notFound(what: string): AppException {
  return new AppException(ErrorCode.NotFound, 404, `No existe esa ${what}`);
}
