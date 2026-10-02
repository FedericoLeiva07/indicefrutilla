import { Injectable } from '@nestjs/common';
import type { IndexLevel } from '@indice/shared';
import { DataSource, type EntityManager } from 'typeorm';

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
}
