import { Injectable } from '@nestjs/common';
import type {
  Presentation,
  Quality,
  ReportItemDto,
  ReportSort,
  ReportStatus,
} from '@indice/shared';
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

  async list(params: {
    lat: number;
    lng: number;
    radius: number;
    sort: ReportSort;
    since: string;
    offset: number;
    limit: number;
  }): Promise<{ items: ReportItemDto[]; total: number }> {
    const where = `r.status = 'active' AND r.observed_at >= $4::date
                   AND ST_DWithin(s.location, pt.g, $3)`;
    const args = [params.lat, params.lng, params.radius, params.since];
    const [rows, [count]]: [ItemRow[], Array<{ total: number }>] = await Promise.all([
      this.dataSource.query(
        `WITH pt AS (SELECT ${POINT} AS g)
         SELECT ${ITEM_COLUMNS}, round(ST_Distance(s.location, pt.g))::int AS "distanceM"
           FROM reports r JOIN stores s ON s.id = r.store_id, pt
          WHERE ${where}
          ORDER BY ${ORDER[params.sort]}
          LIMIT $5 OFFSET $6`,
        [...args, params.limit, params.offset],
      ),
      this.dataSource.query(
        `WITH pt AS (SELECT ${POINT} AS g)
         SELECT count(*)::int AS total
           FROM reports r JOIN stores s ON s.id = r.store_id, pt
          WHERE ${where}`,
        args,
      ),
    ]);
    return { items: rows.map(toItem), total: count?.total ?? 0 };
  }

  async findById(id: number): Promise<(ReportItemDto & { status: ReportStatus }) | null> {
    const rows: Array<ItemRow & { status: ReportStatus }> = await this.dataSource.query(
      `SELECT ${ITEM_COLUMNS}, NULL::int AS "distanceM", r.status
         FROM reports r JOIN stores s ON s.id = r.store_id
        WHERE r.id = $1`,
      [id],
    );
    const row = rows[0];
    return row ? { ...toItem(row), status: row.status } : null;
  }
}

const POINT = `ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography`;

const ITEM_COLUMNS = `
  r.id, r.price_ars AS "priceArs", r.presentation, r.quantity_g AS "quantityG",
  r.price_per_kg AS "pricePerKg", r.quality,
  to_char(r.observed_at, 'YYYY-MM-DD') AS "observedAt", r.created_at AS "createdAt",
  r.reporter_name AS "reporterName",
  s.id AS "storeId", s.name AS "storeName", s.address AS "storeAddress",
  ST_Y(s.location::geometry) AS "storeLat", ST_X(s.location::geometry) AS "storeLng"`;

const ORDER: Record<ReportSort, string> = {
  price: `r.price_per_kg ASC, r.id DESC`,
  distance: `s.location <-> pt.g, r.id DESC`,
  recent: `r.observed_at DESC, r.created_at DESC, r.id DESC`,
};

interface ItemRow extends Omit<ReportItemDto, 'store' | 'createdAt'> {
  createdAt: Date;
  storeId: number;
  storeName: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
}

function toItem(row: ItemRow): ReportItemDto {
  const { storeId, storeName, storeAddress, storeLat, storeLng, createdAt, ...rest } = row;
  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    store: {
      id: storeId,
      name: storeName,
      address: storeAddress,
      location: { lat: storeLat, lng: storeLng },
    },
  };
}
