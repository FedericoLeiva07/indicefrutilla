import { Injectable } from '@nestjs/common';
import {
  COMMUNITY_THRESHOLDS,
  type Presentation,
  type Quality,
  type ReportItemDto,
  type ReportSort,
  type ReportStatus,
} from '@indice/shared';
import { DataSource, type EntityManager } from 'typeorm';
import { VOTE_BALANCE, VOTES_LATERAL } from './report-votes.sql';

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
    deviceId: string | null;
  }): Promise<{ items: ReportItemDto[]; total: number }> {
    const rows: Array<ItemRow & { total: number }> = await this.dataSource.query(
      `WITH pt AS (SELECT ${POINT} AS g),
       downvoted AS (
         SELECT v.report_id
           FROM report_votes v
           JOIN reports rv ON rv.id = v.report_id
          WHERE rv.observed_at >= $4::date
          GROUP BY v.report_id
         HAVING ${VOTE_BALANCE('v')} <= ${COMMUNITY_THRESHOLDS.minVoteBalance}
       ),
       nearby AS MATERIALIZED (
         SELECT s.id AS store_id, ST_Distance(s.location, pt.g) AS distance
           FROM stores s, pt
          WHERE ST_DWithin(s.location, pt.g, $3)
       ),
       ranked AS (
         SELECT r.id AS rid,
                round(n.distance)::int AS distance_m,
                row_number() OVER (ORDER BY ${ORDER[params.sort]}) AS rn,
                count(*) OVER () AS total
           FROM nearby n
           JOIN reports r ON r.store_id = n.store_id
          WHERE r.status = 'active'
            AND r.observed_at >= $4::date
            AND r.id NOT IN (SELECT report_id FROM downvoted)
       )
       SELECT ${ITEM_COLUMNS}, ranked.distance_m AS "distanceM", ranked.total::int AS total
         FROM ranked
         JOIN reports r ON r.id = ranked.rid
         JOIN stores s ON s.id = r.store_id
         ${VOTES_LATERAL('$5')}
        WHERE ranked.rn > $6 AND ranked.rn <= $6 + $7
        ORDER BY ranked.rn`,
      [
        params.lat,
        params.lng,
        params.radius,
        params.since,
        params.deviceId,
        params.offset,
        params.limit,
      ],
    );
    return {
      items: rows.map(({ total: _total, ...row }) => toItem(row)),
      total: rows[0]?.total ?? 0,
    };
  }

  async findById(
    id: number,
    deviceId: string | null,
    em: EntityManager = this.dataSource.manager,
  ): Promise<(ReportItemDto & { status: ReportStatus; voteBalance: number }) | null> {
    const rows: Array<ItemRow & { status: ReportStatus; voteBalance: number }> = await em.query(
      `SELECT ${ITEM_COLUMNS}, NULL::int AS "distanceM", r.status, vt.balance AS "voteBalance"
         FROM reports r JOIN stores s ON s.id = r.store_id ${VOTES_LATERAL('$2')}
        WHERE r.id = $1`,
      [id, deviceId],
    );
    const row = rows[0];
    if (!row) return null;
    const { status, voteBalance, ...itemRow } = row;
    return { ...toItem(itemRow), status, voteBalance };
  }
}

const POINT = `ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography`;

const ITEM_COLUMNS = `
  r.id, r.price_ars AS "priceArs", r.presentation, r.quantity_g AS "quantityG",
  r.price_per_kg AS "pricePerKg", r.quality,
  to_char(r.observed_at, 'YYYY-MM-DD') AS "observedAt", r.created_at AS "createdAt",
  r.reporter_name AS "reporterName",
  s.id AS "storeId", s.name AS "storeName", s.address AS "storeAddress",
  ST_Y(s.location::geometry) AS "storeLat", ST_X(s.location::geometry) AS "storeLng",
  vt.up AS "votesUp", vt.down AS "votesDown", vt.my_vote AS "myVote"`;

const ORDER: Record<ReportSort, string> = {
  price: `r.price_per_kg ASC, r.id DESC`,
  distance: `n.distance, r.id DESC`,
  recent: `r.observed_at DESC, r.created_at DESC, r.id DESC`,
};

interface ItemRow extends Omit<ReportItemDto, 'store' | 'createdAt' | 'votes'> {
  createdAt: Date;
  votesUp: number;
  votesDown: number;
  storeId: number;
  storeName: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
}

function toItem(row: ItemRow): ReportItemDto {
  const {
    storeId,
    storeName,
    storeAddress,
    storeLat,
    storeLng,
    createdAt,
    votesUp,
    votesDown,
    ...rest
  } = row;
  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    votes: { up: votesUp, down: votesDown },
    store: {
      id: storeId,
      name: storeName,
      address: storeAddress,
      location: { lat: storeLat, lng: storeLng },
    },
  };
}
