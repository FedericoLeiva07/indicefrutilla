import { Injectable } from '@nestjs/common';
import type { NearbyStoreDto, StoreCandidateDto, StoreDto } from '@indice/shared';
import { DataSource, type EntityManager } from 'typeorm';

const LIST_LIMIT = 20;
const DUPLICATE_RADIUS_M = 50;
const DUPLICATE_SIMILARITY = 0.4;
const DUPLICATE_LIMIT = 3;

const point = (latParam: string, lngParam: string) =>
  `ST_SetSRID(ST_MakePoint(${lngParam}, ${latParam}), 4326)::geography`;

const STORE_COLUMNS = `
  s.id, s.name, s.address,
  ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lng,
  s.province_id AS "provinceId", s.department_id AS "departmentId"`;

const NEARBY_COLUMNS = `${STORE_COLUMNS},
  round(ST_Distance(s.location, pt.g))::int AS "distanceM",
  (SELECT count(*) FROM reports r WHERE r.store_id = s.id AND r.status = 'active')::int AS "reportCount"`;

type StoreRow = Omit<StoreDto, 'location'> & { lat: number; lng: number };
type NearbyRow = StoreRow & { distanceM: number; reportCount: number };

export interface NewStore {
  name: string;
  nameNormalized: string;
  address: string;
  lat: number;
  lng: number;
  provinceId: string;
  departmentId: string;
  deviceId: string;
  ipHash: Buffer;
}

@Injectable()
export class StoresQueries {
  constructor(private readonly dataSource: DataSource) {}

  async nearby(lat: number, lng: number, radius: number): Promise<NearbyStoreDto[]> {
    const rows: NearbyRow[] = await this.dataSource.query(
      `WITH pt AS (SELECT ${point('$1', '$2')} AS g)
       SELECT ${NEARBY_COLUMNS}
         FROM stores s, pt
        WHERE ST_DWithin(s.location, pt.g, $3)
        ORDER BY s.location <-> pt.g, s.id
        LIMIT ${LIST_LIMIT}`,
      [lat, lng, radius],
    );
    return rows.map(toNearby);
  }

  async search(q: string, lat: number, lng: number, radius: number): Promise<NearbyStoreDto[]> {
    const rows: NearbyRow[] = await this.dataSource.query(
      `WITH pt AS (SELECT ${point('$1', '$2')} AS g)
       SELECT ${NEARBY_COLUMNS}
         FROM stores s, pt
        WHERE ST_DWithin(s.location, pt.g, $3)
          AND (s.name_normalized % $4 OR s.name_normalized LIKE '%' || $4 || '%')
        ORDER BY similarity(s.name_normalized, $4) DESC, s.location <-> pt.g, s.id
        LIMIT ${LIST_LIMIT}`,
      [lat, lng, radius, q],
    );
    return rows.map(toNearby);
  }

  async findById(
    id: number,
    em: EntityManager = this.dataSource.manager,
  ): Promise<StoreRow | null> {
    const rows: StoreRow[] = await em.query(
      `SELECT ${STORE_COLUMNS} FROM stores s WHERE s.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async possibleDuplicates(
    em: EntityManager,
    nameNormalized: string,
    lat: number,
    lng: number,
  ): Promise<StoreCandidateDto[]> {
    const rows: NearbyRow[] = await em.query(
      `WITH pt AS (SELECT ${point('$1', '$2')} AS g)
       SELECT ${NEARBY_COLUMNS}
         FROM stores s, pt
        WHERE ST_DWithin(s.location, pt.g, ${DUPLICATE_RADIUS_M})
          AND similarity(s.name_normalized, $3) >= ${DUPLICATE_SIMILARITY}
        ORDER BY similarity(s.name_normalized, $3) DESC, s.location <-> pt.g
        LIMIT ${DUPLICATE_LIMIT}`,
      [lat, lng, nameNormalized],
    );
    return rows.map(({ id, name, address, lat, lng, distanceM, reportCount }) => ({
      id,
      name,
      address,
      location: { lat, lng },
      distanceM,
      reportCount,
    }));
  }

  async insert(em: EntityManager, store: NewStore): Promise<StoreDto> {
    const [row]: StoreRow[] = await em.query(
      `INSERT INTO stores (name, name_normalized, address, location, province_id, department_id,
                           created_by_device, created_ip_hash)
       VALUES ($1, $2, $3, ${point('$4', '$5')}, $6, $7, $8, $9)
       RETURNING id, name, address,
                 ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
                 province_id AS "provinceId", department_id AS "departmentId"`,
      [
        store.name,
        store.nameNormalized,
        store.address,
        store.lat,
        store.lng,
        store.provinceId,
        store.departmentId,
        store.deviceId,
        store.ipHash,
      ],
    );
    return toStore(row!);
  }
}

export function toStore({ lat, lng, ...row }: StoreRow): StoreDto {
  return { ...row, location: { lat, lng } };
}

function toNearby({ lat, lng, ...row }: NearbyRow): NearbyStoreDto {
  return { ...row, location: { lat, lng } };
}
