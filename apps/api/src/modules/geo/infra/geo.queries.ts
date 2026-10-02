import { Injectable } from '@nestjs/common';
import type { DepartmentDto, LocalityDto, ProvinceDto, ResolvedLocationDto } from '@indice/shared';
import { DataSource } from 'typeorm';

const RESOLVE_TOLERANCE_M = 5_000;

const naturalOrder = (col: string) =>
  `regexp_replace(${col}, '\\d+', '', 'g'), COALESCE(substring(${col} from '\\d+')::int, 0), ${col}`;

const centroid = (alias: string) =>
  `ST_Y(${alias}.centroid::geometry) AS lat, ST_X(${alias}.centroid::geometry) AS lng`;

interface CentroidRow {
  lat: number;
  lng: number;
}

@Injectable()
export class GeoQueries {
  constructor(private readonly dataSource: DataSource) {}

  async provinces(): Promise<ProvinceDto[]> {
    const rows: Array<CentroidRow & { id: string; name: string }> = await this.dataSource.query(
      `SELECT p.id, p.name, ${centroid('p')} FROM provinces p ORDER BY p.name`,
    );
    return rows.map(({ lat, lng, ...r }) => ({ ...r, centroid: { lat, lng } }));
  }

  async provinceExists(id: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(`SELECT 1 FROM provinces WHERE id = $1`, [
      id,
    ]);
    return rows.length > 0;
  }

  async departmentExists(id: string): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(`SELECT 1 FROM departments WHERE id = $1`, [
      id,
    ]);
    return rows.length > 0;
  }

  async departments(provinceId: string): Promise<DepartmentDto[]> {
    const rows: Array<CentroidRow & Omit<DepartmentDto, 'centroid'>> = await this.dataSource.query(
      `SELECT d.id, d.province_id AS "provinceId", d.name, d.category, ${centroid('d')}
         FROM departments d
        WHERE d.province_id = $1
        ORDER BY ${naturalOrder('d.name')}`,
      [provinceId],
    );
    return rows.map(({ lat, lng, ...r }) => ({ ...r, centroid: { lat, lng } }));
  }

  async localities(departmentId: string): Promise<LocalityDto[]> {
    const rows: Array<CentroidRow & Omit<LocalityDto, 'centroid'>> = await this.dataSource.query(
      `SELECT l.id, l.province_id AS "provinceId", l.department_id AS "departmentId", l.name, ${centroid('l')}
         FROM localities l
        WHERE l.department_id = $1
        ORDER BY ${naturalOrder('l.name')}`,
      [departmentId],
    );
    return rows.map(({ lat, lng, ...r }) => ({ ...r, centroid: { lat, lng } }));
  }

  async resolve(lat: number, lng: number): Promise<ResolvedLocationDto | null> {
    const rows: Array<{ did: string; dname: string; pid: string; pname: string }> =
      await this.dataSource.query(
        `WITH pt AS (SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS g)
         SELECT d.id AS did, d.name AS dname, p.id AS pid, p.name AS pname
           FROM departments d
           JOIN provinces p ON p.id = d.province_id, pt
          WHERE ST_DWithin(d.geom, pt.g, $3)
          ORDER BY ST_Distance(d.geom, pt.g)
          LIMIT 1`,
        [lat, lng, RESOLVE_TOLERANCE_M],
      );
    const row = rows[0];
    if (!row) return null;
    return {
      province: { id: row.pid, name: row.pname },
      department: { id: row.did, name: row.dname },
    };
  }
}
