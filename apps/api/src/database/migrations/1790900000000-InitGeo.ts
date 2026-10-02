import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitGeo1790900000000 implements MigrationInterface {
  name = 'InitGeo1790900000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await q.query(`
      CREATE TABLE provinces (
        id varchar(2) PRIMARY KEY,
        name varchar(100) NOT NULL,
        centroid geography(Point, 4326) NOT NULL
      )`);

    await q.query(`
      CREATE TABLE departments (
        id varchar(5) PRIMARY KEY,
        province_id varchar(2) NOT NULL REFERENCES provinces(id),
        name varchar(100) NOT NULL,
        category varchar(50) NOT NULL,
        centroid geography(Point, 4326) NOT NULL,
        geom geography(MultiPolygon, 4326) NOT NULL
      )`);
    await q.query(`CREATE INDEX departments_province_idx ON departments (province_id)`);
    await q.query(`CREATE INDEX departments_geom_idx ON departments USING GIST (geom)`);

    await q.query(`
      CREATE TABLE localities (
        id varchar(20) PRIMARY KEY,
        province_id varchar(2) NOT NULL REFERENCES provinces(id),
        department_id varchar(5) REFERENCES departments(id),
        name varchar(150) NOT NULL,
        centroid geography(Point, 4326) NOT NULL
      )`);
    await q.query(`CREATE INDEX localities_department_idx ON localities (department_id)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE localities`);
    await q.query(`DROP TABLE departments`);
    await q.query(`DROP TABLE provinces`);
  }
}
