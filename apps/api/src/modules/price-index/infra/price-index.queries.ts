import { Injectable } from '@nestjs/common';
import { COUNTRY_ZONE_ID, INDEX_PUBLISH_THRESHOLD, type IndexLevel } from '@indice/shared';
import { DataSource, type EntityManager } from 'typeorm';

export interface IndexRow {
  weekStart: string;
  level: IndexLevel;
  zoneId: string;
  medianPpk: number | null;
  p25Ppk: number | null;
  p75Ppk: number | null;
  sampleSize: number;
  storeCount: number;
  published: boolean;
}

@Injectable()
export class PriceIndexQueries {
  constructor(private readonly dataSource: DataSource) {}

  async publishedMedian(
    level: IndexLevel,
    zoneId: string,
    weekStart: string,
    em: EntityManager = this.dataSource.manager,
  ): Promise<number | null> {
    const rows: Array<{ median_ppk: number }> = await em.query(
      `SELECT median_ppk
         FROM price_index_weekly
        WHERE week_start = $1 AND level = $2 AND zone_id = $3
          AND published AND median_ppk IS NOT NULL`,
      [weekStart, level, zoneId],
    );
    return rows[0]?.median_ppk ?? null;
  }

  async recompute(weekStart: string): Promise<number> {
    return this.dataSource.transaction(async (em) => {
      await em.query(`DELETE FROM price_index_weekly WHERE week_start = $1`, [weekStart]);
      const [, inserted]: [unknown, number] = await em.query(
        `WITH eligible AS (
           SELECT r.store_id, r.price_per_kg, s.department_id, s.province_id
             FROM reports r
             JOIN stores s ON s.id = r.store_id
            WHERE r.status = 'active'
              AND r.quality = 'primera'
              AND r.observed_at BETWEEN $1::date AND $1::date + 6
         ),
         per_store AS (
           SELECT store_id, department_id, province_id, count(*) AS n,
                  percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_kg) AS ppk
             FROM eligible
            GROUP BY store_id, department_id, province_id
         ),
         zones AS (
           SELECT 'department'::index_level AS level, department_id AS zone_id, n, ppk FROM per_store
           UNION ALL
           SELECT 'province'::index_level, province_id, n, ppk FROM per_store
           UNION ALL
           SELECT 'country'::index_level, '${COUNTRY_ZONE_ID}', n, ppk FROM per_store
         )
         INSERT INTO price_index_weekly
           (week_start, level, zone_id, median_ppk, p25_ppk, p75_ppk, sample_size, store_count,
            published, computed_at)
         SELECT $1::date, level, zone_id,
                round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ppk)::numeric, 2),
                round(percentile_cont(0.25) WITHIN GROUP (ORDER BY ppk)::numeric, 2),
                round(percentile_cont(0.75) WITHIN GROUP (ORDER BY ppk)::numeric, 2),
                sum(n)::int, count(*)::int,
                sum(n) >= ${INDEX_PUBLISH_THRESHOLD.reports} AND count(*) >= ${INDEX_PUBLISH_THRESHOLD.stores},
                now()
           FROM zones
          GROUP BY level, zone_id`,
        [weekStart],
      );
      return inserted;
    });
  }

  async rows(
    weekStarts: string[],
    zones: Array<{ level: IndexLevel; id: string }>,
  ): Promise<IndexRow[]> {
    if (zones.length === 0 || weekStarts.length === 0) return [];
    return this.dataSource.query(
      `SELECT to_char(week_start, 'YYYY-MM-DD') AS "weekStart", level, zone_id AS "zoneId",
              median_ppk AS "medianPpk", p25_ppk AS "p25Ppk", p75_ppk AS "p75Ppk",
              sample_size AS "sampleSize", store_count AS "storeCount", published
         FROM price_index_weekly
        WHERE week_start = ANY($1::date[])
          AND (level, zone_id) IN (SELECT * FROM unnest($2::index_level[], $3::text[]))`,
      [weekStarts, zones.map((z) => z.level), zones.map((z) => z.id)],
    );
  }

  async provinceWindow(from: string, to: string): Promise<WindowRow[]> {
    return this.dataSource.query(
      `WITH per_store_week AS (
         SELECT s.province_id, r.store_id, date_trunc('week', r.observed_at) AS week, count(*) AS n,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY r.price_per_kg) AS ppk
           FROM reports r
           JOIN stores s ON s.id = r.store_id
          WHERE r.status = 'active' AND r.quality = 'primera'
            AND r.observed_at BETWEEN $1::date AND $2::date
          GROUP BY s.province_id, r.store_id, week
       )
       SELECT COALESCE(province_id, '${COUNTRY_ZONE_ID}') AS "zoneId",
              round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ppk)::numeric, 2) AS "medianPpk",
              round(percentile_cont(0.25) WITHIN GROUP (ORDER BY ppk)::numeric, 2) AS "p25Ppk",
              round(percentile_cont(0.75) WITHIN GROUP (ORDER BY ppk)::numeric, 2) AS "p75Ppk",
              sum(n)::int AS "sampleSize",
              count(DISTINCT store_id)::int AS "storeCount"
         FROM per_store_week
        GROUP BY ROLLUP (province_id)`,
      [from, to],
    );
  }

  async history(level: IndexLevel, zoneId: string, from: string): Promise<IndexRow[]> {
    return this.dataSource.query(
      `SELECT to_char(week_start, 'YYYY-MM-DD') AS "weekStart", level, zone_id AS "zoneId",
              median_ppk AS "medianPpk", p25_ppk AS "p25Ppk", p75_ppk AS "p75Ppk",
              sample_size AS "sampleSize", store_count AS "storeCount", published
         FROM price_index_weekly
        WHERE level = $1 AND zone_id = $2 AND week_start >= $3::date
        ORDER BY week_start`,
      [level, zoneId, from],
    );
  }
}

export interface WindowRow {
  zoneId: string;
  medianPpk: number;
  p25Ppk: number;
  p75Ppk: number;
  sampleSize: number;
  storeCount: number;
}
