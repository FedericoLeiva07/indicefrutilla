import { Injectable } from '@nestjs/common';
import type { Presentation, Quality } from '@indice/shared';
import { DataSource, type EntityManager } from 'typeorm';

export interface StoreZone {
  storeId: number;
  departmentId: string;
  departmentName: string;
}

export interface NewReport {
  storeId: number;
  priceArs: number;
  presentation: Presentation;
  quantityG: number;
  pricePerKg: number;
  quality: Quality;
  observedAt: string;
  reporterName: string | null;
  deviceId: string;
  ipHash: Buffer;
}

@Injectable()
export class ReportsQueries {
  constructor(private readonly dataSource: DataSource) {}

  async storeZone(storeId: number): Promise<StoreZone | null> {
    const rows: StoreZone[] = await this.dataSource.query(
      `SELECT s.id AS "storeId", d.id AS "departmentId", d.name AS "departmentName"
         FROM stores s
         JOIN departments d ON d.id = s.department_id
        WHERE s.id = $1`,
      [storeId],
    );
    return rows[0] ?? null;
  }

  async insert(em: EntityManager, report: NewReport): Promise<{ id: number; pricePerKg: number }> {
    const [row]: Array<{ id: number; pricePerKg: number }> = await em.query(
      `INSERT INTO reports (store_id, price_ars, presentation, quantity_g, price_per_kg, quality,
                            observed_at, reporter_name, device_id, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, price_per_kg AS "pricePerKg"`,
      [
        report.storeId,
        report.priceArs,
        report.presentation,
        report.quantityG,
        report.pricePerKg,
        report.quality,
        report.observedAt,
        report.reporterName,
        report.deviceId,
        report.ipHash,
      ],
    );
    return row!;
  }
}
