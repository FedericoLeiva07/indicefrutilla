import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export const CURRENT_REFERENCE_DAYS = 7;

@Injectable()
export class ReferenceQueries {
  constructor(private readonly dataSource: DataSource) {}

  async current(): Promise<{ date: string; modalPpk: number } | null> {
    const [row]: Array<{ date: string | null; modal: number | null }> = await this.dataSource.query(
      `WITH daily AS (
         SELECT date, percentile_cont(0.5) WITHIN GROUP (ORDER BY modal_ppk) AS ref
           FROM reference_prices
          GROUP BY date
          ORDER BY date DESC
          LIMIT ${CURRENT_REFERENCE_DAYS}
       )
       SELECT to_char(max(date), 'YYYY-MM-DD') AS date,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY ref) AS modal
         FROM daily`,
    );
    if (!row?.date || row.modal === null) return null;
    return { date: row.date, modalPpk: row.modal };
  }
}
